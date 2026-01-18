import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useTopics() {
  return useQuery({
    queryKey: [api.content.listTopics.path],
    queryFn: async () => {
      const res = await fetch(api.content.listTopics.path);
      if (!res.ok) throw new Error("Failed to fetch topics");
      return api.content.listTopics.responses[200].parse(await res.json());
    },
  });
}

export function useTopic(id: string) {
  return useQuery({
    queryKey: [api.content.getTopic.path, id],
    queryFn: async () => {
      const url = buildUrl(api.content.getTopic.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch topic");
      return api.content.getTopic.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}
