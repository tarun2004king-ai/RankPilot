import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function ProtectedRoute() {
    const {loading , token} = useApp();

    if(loading){
        return(
            <div className="inline-flex" role="status" aria-label="loading">
                <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden="true">
                <span className="absolute inline-flex size-4 rounded-full border border-foreground/50 animate-ping"></span>
                <span className="inline-flex size-4 rounded-full border border-foreground"></span>
                </span>
                <span className="sr-only">Loading...</span>
            </div>
        )
    }

    if(!token){
        return <Navigate to="/login" replace />;
    }
    
    return <Outlet />;
}
