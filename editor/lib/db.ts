/**
 * IndexedDB 저장소 — Dexie.js
 * 자동 저장, 프로젝트 관리, JSON Import/Export
 */
import Dexie, { type Table } from 'dexie';
import type { SlideType, TextLayout, Composition, ProductStyle, ProjectStatus } from './openspec';

// ─── 타입 정의 ─────────────────────────────────────

export interface Slide {
  index: number;
  type: SlideType;
  headline: string | null;
  body: string[] | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  background: string;
  textLayout: TextLayout | null;
  composition: Composition | null;
  productStyle: ProductStyle | null;
  userPhoto: boolean;
  overlay?: {
    productName: string;
    price: string;
    position: string;
  };
  buttonText?: string;
  buttonUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

export interface Project {
  id?: number;
  title: string;
  vol: number;
  status: ProjectStatus;
  productUrl: string;
  affiliateUrl: string;
  productName: string;
  productPrice: string;
  productCategory: string;
  productSpecs: string[];
  productImageUrl: string | null;
  userPhotoBlob: Blob | null;
  slides: Slide[];
  caption: {
    editorsNote: string;
    body: string;
    cta: string;
    hashtags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// ─── Dexie 데이터베이스 ─────────────────────────────

class CardNewsDB extends Dexie {
  projects!: Table<Project, number>;

  constructor() {
    super('CardNewsEditor');
    this.version(1).stores({
      projects: '++id, title, status, vol, createdAt, updatedAt',
    });
  }
}

export const db = new CardNewsDB();

// ─── 프로젝트 CRUD ─────────────────────────────────

export async function createProject(partial: Partial<Project> = {}): Promise<number> {
  const nextVol = await getNextVol();
  const now = new Date();

  const project: Omit<Project, 'id'> = {
    title: '새 카드뉴스',
    vol: nextVol,
    status: 'draft',
    productUrl: '',
    affiliateUrl: '',
    productName: '',
    productPrice: '',
    productCategory: '',
    productSpecs: [],
    productImageUrl: null,
    userPhotoBlob: null,
    slides: [],
    caption: {
      editorsNote: '',
      body: '',
      cta: '자세한 정보는 프로필 링크의\n\'일인양품\' 리스트에서 확인하세요.',
      hashtags: ['#일인양품', '#1인가구라이프', '#미니멀인테리어', '#내돈내산리뷰', '#자취꿀템'],
    },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };

  return db.projects.add(project);
}

export async function getProject(id: number): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function updateProject(id: number, changes: Partial<Project>): Promise<void> {
  await db.projects.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

export async function deleteProject(id: number): Promise<void> {
  await db.projects.delete(id);
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function getProjectsByStatus(status: ProjectStatus): Promise<Project[]> {
  return db.projects.where('status').equals(status).reverse().sortBy('updatedAt');
}

export async function getNextVol(): Promise<number> {
  const latest = await db.projects.orderBy('vol').reverse().first();
  return latest ? latest.vol + 1 : 1;
}

// ─── Import/Export ──────────────────────────────────

export async function exportProjectAsJSON(id: number): Promise<string> {
  const project = await getProject(id);
  if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');
  // Blob은 직렬화하지 않음 (구조분해로 제외)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userPhotoBlob, ...exportable } = project;
  return JSON.stringify(exportable, null, 2);
}

export async function importProjectFromJSON(json: string): Promise<number> {
  const data = JSON.parse(json);
  // id 제거 (새로 생성)
  delete data.id;
  data.status = 'draft';
  data.createdAt = new Date();
  data.updatedAt = new Date();
  data.userPhotoBlob = null;
  return createProject(data);
}
