import { useQuery } from "@tanstack/react-query";

export function useGlobalQuery() {
  return useQuery({
    queryKey: ["repoData"],
    queryFn: async () => {
      const data = await Promise.all([
        browser.bookmarks.getTree(),
        browser.topSites.get(),
        browser.tabGroups.query({}),
        browser.tabs.query({}),
        browser.windows.getAll(),
      ]);
      return ["bookmarks", "topSites", "tabGroups", "tabs", "windows"].map(
        (title, i) => [title, JSON.stringify(data[i])],
      );
    },
  });
}
