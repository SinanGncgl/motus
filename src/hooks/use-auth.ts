import { useCallback } from "react";
const localUser = { id: "local-user", name: "Local learner", email: "local@localhost", isAnonymous: true };
export function useAuth(){const signOut=useCallback(async()=>undefined,[]);const signIn=useCallback(async()=>({user:localUser}),[]);return {user:localUser,isLoading:false,isAuthenticated:true,signIn,signOut};}
