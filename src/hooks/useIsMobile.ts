import { useState, useEffect } from "react";

export const useIsMobile = (breakpoint: number = 768): boolean => {
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);

        const handleChange = () => {
            setIsMobile(mql.matches);
        };

        mql.addEventListener("change", handleChange);

        setIsMobile(mql.matches);

        return () => mql.removeEventListener("change", handleChange);
    }, [breakpoint]);

    return isMobile;
};

