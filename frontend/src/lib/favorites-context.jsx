import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const FavoritesContext = createContext({ ids: [], has: () => false, toggle: () => {} });

// Restaurants a member has saved. One fetch for the whole app; hearts read from it.
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ids, setIds] = useState([]);
  const signedIn = !!user;

  useEffect(() => {
    if (!signedIn) {
      setIds([]);
      return;
    }
    api.get("/members/me/favorites").then(({ data }) => setIds(data)).catch(() => {});
  }, [signedIn]);

  const toggle = useCallback(
    async (venueId) => {
      if (!signedIn) {
        toast("Sign in to save restaurants.", { action: { label: "Sign in", onClick: () => navigate("/login") } });
        return;
      }
      const saved = ids.includes(venueId);
      setIds((cur) => (saved ? cur.filter((i) => i !== venueId) : [...cur, venueId])); // optimistic
      try {
        await (saved ? api.delete(`/venues/${venueId}/favorite`) : api.put(`/venues/${venueId}/favorite`));
      } catch {
        setIds((cur) => (saved ? [...cur, venueId] : cur.filter((i) => i !== venueId)));
        toast.error("Could not update your saved restaurants.");
      }
    },
    [signedIn, ids, navigate],
  );

  const value = useMemo(() => ({ ids, has: (id) => ids.includes(id), toggle }), [ids, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);
