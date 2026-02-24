/**
 * Zustand 프로젝트 상태 관리
 * 자동 저장(debounce 2초), 프로젝트 로드/저장
 */
import { create } from 'zustand';
import type { Project, Slide } from '@/lib/db';
import { getProject, updateProject, createProject } from '@/lib/db';

interface SaveStatus {
  state: 'saved' | 'saving' | 'error' | 'idle';
  lastSavedAt: Date | null;
}

interface ProjectState {
  // 현재 프로젝트
  project: Project | null;
  currentSlideIndex: number;
  saveStatus: SaveStatus;

  // 액션
  loadProject: (id: number) => Promise<void>;
  createNewProject: () => Promise<number>;
  updateField: <K extends keyof Project>(key: K, value: Project[K]) => void;
  updateSlide: (index: number, changes: Partial<Slide>) => void;
  addSlide: (slide: Slide) => void;
  removeSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  moveSlide: (from: number, to: number) => void;
  setCurrentSlide: (index: number) => void;
  saveNow: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  currentSlideIndex: 0,
  saveStatus: { state: 'idle', lastSavedAt: null },

  loadProject: async (id: number) => {
    const project = await getProject(id);
    if (project) {
      set({ project, currentSlideIndex: 0, saveStatus: { state: 'saved', lastSavedAt: project.updatedAt } });
    }
  },

  createNewProject: async () => {
    const id = await createProject();
    const project = await getProject(id);
    if (project) {
      set({ project, currentSlideIndex: 0, saveStatus: { state: 'saved', lastSavedAt: new Date() } });
    }
    return id;
  },

  updateField: (key, value) => {
    const { project } = get();
    if (!project) return;

    set({ project: { ...project, [key]: value } });
    scheduleSave(get);
  },

  updateSlide: (index, changes) => {
    const { project } = get();
    if (!project) return;

    const slides = [...project.slides];
    slides[index] = { ...slides[index], ...changes };
    set({ project: { ...project, slides } });
    scheduleSave(get);
  },

  addSlide: (slide) => {
    const { project } = get();
    if (!project) return;

    const slides = [...project.slides, slide];
    set({ project: { ...project, slides } });
    scheduleSave(get);
  },

  removeSlide: (index) => {
    const { project } = get();
    if (!project) return;

    const slides = project.slides.filter((_, i) => i !== index);
    // 인덱스 재정렬
    slides.forEach((s, i) => { s.index = i; });
    set({ project: { ...project, slides } });
    scheduleSave(get);
  },

  duplicateSlide: (index) => {
    const { project } = get();
    if (!project) return;

    const original = project.slides[index];
    if (original.type !== 'solution') return; // Solution만 복제 가능

    const duplicate: Slide = {
      ...original,
      index: index + 1,
      imageUrl: null,
      status: 'pending',
    };

    const slides = [...project.slides];
    slides.splice(index + 1, 0, duplicate);
    slides.forEach((s, i) => { s.index = i; });
    set({ project: { ...project, slides } });
    scheduleSave(get);
  },

  moveSlide: (from, to) => {
    const { project } = get();
    if (!project) return;

    const slides = [...project.slides];
    const [moved] = slides.splice(from, 1);
    slides.splice(to, 0, moved);
    slides.forEach((s, i) => { s.index = i; });
    set({ project: { ...project, slides } });
    scheduleSave(get);
  },

  setCurrentSlide: (index) => {
    set({ currentSlideIndex: index });
  },

  saveNow: async () => {
    const { project } = get();
    if (!project?.id) return;

    set({ saveStatus: { state: 'saving', lastSavedAt: get().saveStatus.lastSavedAt } });
    try {
      await updateProject(project.id, project);
      set({ saveStatus: { state: 'saved', lastSavedAt: new Date() } });
    } catch {
      set({ saveStatus: { state: 'error', lastSavedAt: get().saveStatus.lastSavedAt } });
    }
  },
}));

/**
 * 2초 debounce 자동 저장
 */
function scheduleSave(get: () => ProjectState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await get().saveNow();
  }, 2000);
}
