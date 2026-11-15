export type NewsArticle = {
  id: string;
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string; // ISO 8601 string
  description?: string | undefined;
  imageUrl?: string | undefined;
  category?: string | undefined;
};

export type NewsSource = {
  id: string;
  name: string;
  url: string;
  description: string;
  defaultEnabled: boolean;
  priority: number;
  /** 18+ source: opt-in only, shown last and highlighted in red. */
  adult?: boolean | undefined;
};

export type NewsFetchResponse = {
  articles: NewsArticle[];
  successfulSources: string[];
  failedSources: string[];
};

export type NewsStoredState = {
  articles: NewsArticle[];
  lastUpdated: number;
  failedSources: string[];
  successfulSources: string[];
};
