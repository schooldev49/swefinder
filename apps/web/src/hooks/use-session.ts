import { useQuery } from "@tanstack/react-query";
import type { User } from "@evidensify/types";
import { fetchCurrentUser } from "@/lib/api";

export function useSession() {
  return useQuery<User | null>({
    queryKey: ["session"],
    queryFn: fetchCurrentUser,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
