import React, { createContext, useContext, useRef, useCallback } from "react";

export type ControlAction = "left" | "right" | "jump" | "attack";

export interface InputState {
    left: boolean;
    right: boolean;
    jump: boolean;
    attack: boolean;
}

export interface GameInputContextData {
    controlsRef: React.RefObject<InputState>;
    setControl: (action: ControlAction, isActive: boolean) => void;
}

const GameInputContext = createContext<GameInputContextData | null>(null);

export const GameInputProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const controlsRef = useRef<InputState>({
        left: false,
        right: false,
        jump: false,
        attack: false,
    });

    const setControl = useCallback(
        (action: ControlAction, isActive: boolean) => {
            controlsRef.current[action] = isActive;
        },
        [],
    );

    return (
        <GameInputContext.Provider value={{ controlsRef, setControl }}>
            {children}
        </GameInputContext.Provider>
    );
};

// Hook personalizado para facilitar o uso
export const useGameInput = () => {
    const context = useContext(GameInputContext);
    if (!context) {
        throw new Error(
            "useGameInput deve ser usado dentro de um GameInputProvider",
        );
    }
    return context;
};

