import { useAuth as useContextAuth } from "../contexts/AuthContext";
import { useAuthActions } from "./useAuthActions";
import { auth } from "../lib/firebase";

/**
 * Unified useAuth Hook returning the user context, loading indicator, Administrator privileges,
 * and high-level auth functions (login, signup, logout)
 */
export const useAuth = () => {
  const { user, loading, isAdmin } = useContextAuth();
  const { login, signup, loading: isActionLoading } = useAuthActions();

  const logout = async () => {
    localStorage.removeItem("konamix_session_uid");
    window.dispatchEvent(new CustomEvent("konamix_auth_changed", { detail: { uid: null } }));
    try {
      await auth.signOut();
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  return {
    user,
    loading: loading || isActionLoading,
    isAdmin,
    login,
    signup,
    logout
  };
};

export default useAuth;
