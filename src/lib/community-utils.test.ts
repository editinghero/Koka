import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRedditInput,
  normalizeXInput,
  normalizeCustomLinkInput,
  normalizeCategory,
  shortCategoryLabel,
  getCommunitiesForMedia,
  filterAndGroupCommunities,
  sortCommunitiesByLastOpen,
  parseAiCommunityResponse,
  DEFAULT_COMMUNITIES,
  type CommunityItem,
} from "./community-utils";

test("normalizeRedditInput handles URLs, r/ prefixes, and raw names", () => {
  assert.deepEqual(normalizeRedditInput("r/manga"), {
    handle: "r/manga",
    url: "https://www.reddit.com/r/manga/",
  });
  assert.deepEqual(normalizeRedditInput("/r/anime/"), {
    handle: "r/anime",
    url: "https://www.reddit.com/r/anime/",
  });
  assert.deepEqual(
    normalizeRedditInput("https://www.reddit.com/r/Frieren/hot/"),
    {
      handle: "r/Frieren",
      url: "https://www.reddit.com/r/Frieren/",
    },
  );
  assert.deepEqual(normalizeRedditInput("ChainsawMan"), {
    handle: "r/ChainsawMan",
    url: "https://www.reddit.com/r/ChainsawMan/",
  });
});

test("normalizeXInput handles @handles, x.com/twitter.com URLs, hashtags, and communities", () => {
  assert.deepEqual(normalizeXInput("@Anime_Frieren"), {
    handle: "@Anime_Frieren",
    url: "https://x.com/Anime_Frieren",
  });
  assert.deepEqual(normalizeXInput("https://twitter.com/AniTrendz"), {
    handle: "@AniTrendz",
    url: "https://x.com/AniTrendz",
  });
  assert.deepEqual(
    normalizeXInput("https://x.com/i/communities/16789012345"),
    {
      handle: "Community #12345",
      url: "https://x.com/i/communities/16789012345",
    },
  );
  assert.deepEqual(normalizeXInput("#BLEACH_anime"), {
    handle: "#BLEACH_anime",
    url: "https://x.com/hashtag/BLEACH_anime",
  });
});

test("normalizeCustomLinkInput handles custom URLs and optional labels", () => {
  assert.deepEqual(
    normalizeCustomLinkInput("discord.gg/frieren", "Frieren Discord"),
    {
      handle: "Frieren Discord",
      url: "https://discord.gg/frieren",
    },
  );
  assert.deepEqual(normalizeCustomLinkInput("https://myanimelist.net/anime/52991"), {
    handle: "myanimelist.net/anime/52991",
    url: "https://myanimelist.net/anime/52991",
  });
});

test("normalizeCategory maps Custom to Other", () => {
  assert.equal(normalizeCategory("Custom"), "Other");
  assert.equal(shortCategoryLabel("Custom"), "Other");
  assert.equal(shortCategoryLabel("Other"), "Other");
});

test("getCommunitiesForMedia matches by mediaId or normalized title", () => {
  const sampleItems: CommunityItem[] = [
    ...DEFAULT_COMMUNITIES,
    {
      id: "series-reddit-frieren",
      platform: "reddit",
      name: "Frieren",
      handle: "r/Frieren",
      url: "https://www.reddit.com/r/Frieren/",
      category: "Anime Series",
      mediaId: 154587,
      mediaType: "ANIME",
      mediaTitle: "Frieren: Beyond Journey's End",
      createdAt: 1700000000065,
      lastOpenedAt: 1700000000095,
    },
  ];
  const frierenById = getCommunitiesForMedia(sampleItems, 154587);
  assert.equal(frierenById.length, 1);
  assert.equal(frierenById[0]?.handle, "r/Frieren");
});

test("sortCommunitiesByLastOpen sorts most recently opened first", () => {
  const items = [
    {
      ...DEFAULT_COMMUNITIES[0]!,
      id: "a",
      lastOpenedAt: 100,
    },
    {
      ...DEFAULT_COMMUNITIES[1]!,
      id: "b",
      lastOpenedAt: 500,
    },
  ];
  const sorted = sortCommunitiesByLastOpen(items);
  assert.equal(sorted[0]?.id, "b");
  assert.equal(sorted[1]?.id, "a");
});

test("filterAndGroupCommunities separates pinnedItems while keeping items in generalItems and animeGroups", () => {
  const { pinnedItems, generalItems, animeGroups } =
    filterAndGroupCommunities(DEFAULT_COMMUNITIES);
  assert.equal(pinnedItems.length, 2);
  assert.equal(generalItems.length, 6);
  assert.equal(animeGroups.length, 0);
});

test("parseAiCommunityResponse parses Gemini JSON and grounding sources into normalized Reddit and X communities", () => {
  const rawJson = JSON.stringify({
    category: "Anime Series",
    redditSubreddit: "r/ChainsawMan",
    redditUrl: "https://www.reddit.com/r/ChainsawMan/",
    redditDescription: "Main Chainsaw Man subreddit",
    xHandleOrHashtag: "@CHAINSAWMAN_PR",
    xUrl: "https://x.com/CHAINSAWMAN_PR",
    xDescription: "Official Chainsaw Man X account",
  });
  const parsed = parseAiCommunityResponse(rawJson, [], "Chainsaw Man", "ANIME");
  assert.equal(parsed.reddit.handle, "r/ChainsawMan");
  assert.equal(parsed.reddit.url, "https://www.reddit.com/r/ChainsawMan/");
  assert.equal(parsed.x.handle, "@CHAINSAWMAN_PR");
  assert.equal(parsed.x.url, "https://x.com/CHAINSAWMAN_PR");
  assert.equal(parsed.category, "Anime Series");
});
