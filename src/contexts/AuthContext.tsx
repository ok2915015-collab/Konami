import { createContext, useContext } from "react";
import { User } from "../types";

export const AuthContext = createContext<{ 
  user: User | null; 
  loading: boolean;
  isAdmin: boolean;
}>({ user: null, loading: true, isAdmin: false });

export const useAuth = () => useContext(AuthContext);
