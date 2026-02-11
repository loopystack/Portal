export interface TimeBlock {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeBlockCreate {
  startAt: string;
  endAt: string;
  summary?: string;
}
