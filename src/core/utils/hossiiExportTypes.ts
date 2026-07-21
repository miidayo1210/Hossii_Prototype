export type HossiiAuthorType = 'guest' | 'account' | 'participant_account';

/** Single row from admin_export_space_hossiis_page (client-safe fields only). */
export type AdminExportHossiiItem = {
  hossiiId: string;
  createdAt: string;
  paneName: string;
  authorType: HossiiAuthorType;
  anonymousId: string;
  message: string | null;
  emotion: string | null;
  hashtags: string[];
  numberValue: number | null;
  postKind: string;
  hasImage: boolean;
  authorDisplayName?: string;
  imageUrl?: string;
};

export type AdminExportCursor = {
  createdAt: string;
  id: string;
};

export type AdminExportPageResult = {
  items: AdminExportHossiiItem[];
  nextCursor: AdminExportCursor | null;
  hasMore: boolean;
  pageCount: number;
};

export type AdminExportProgress = {
  fetchedCount: number;
  pageCount: number;
};

export type AdminExportFetchPageOptions = {
  spaceId: string;
  spacePaneId?: string | null;
  cursor?: AdminExportCursor | null;
  limit?: number;
  includeAuthorDisplayNames?: boolean;
  includeImageUrls?: boolean;
  signal?: AbortSignal;
};

export type AdminExportFetchAllOptions = Omit<AdminExportFetchPageOptions, 'cursor'> & {
  onProgress?: (progress: AdminExportProgress) => void;
};

export type AdminExportResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; partialCount?: number };
