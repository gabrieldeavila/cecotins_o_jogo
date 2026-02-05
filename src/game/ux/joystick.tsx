import {
    FaLongArrowAltLeft,
    FaLongArrowAltRight,
    FaLongArrowAltUp,
} from "react-icons/fa";
import { useGameInput } from "../../context/game";
import { useIsMobile } from "../../hooks/useIsMobile";

function Joystick() {
    const isMobile = useIsMobile();

    if (!isMobile) return null;

    return (
        <div
            style={{
                position: "absolute",
                bottom: "1rem",
                left: "2rem",
                right: "2rem",
                display: "flex",
                justifyContent: "space-between",
            }}
        >
            <div
                style={{
                    display: "flex",
                }}
            >
                <Button
                    icon={<FaLongArrowAltLeft fill="white" />}
                    controlName="left"
                />
                <Button
                    icon={<FaLongArrowAltRight fill="white" />}
                    controlName="right"
                />
            </div>

            <div
                style={{
                    display: "flex",
                }}
            >
                <Button
                    backgroundColor="rgba(255,0,0,0.3)"
                    borderColor="#ff000066"
                    icon={<FaLongArrowAltUp fill="#f8dfdf" />}
                    controlName="jump"
                />
            </div>
        </div>
    );
}

export default Joystick;

const Button = ({
    icon,
    controlName,
    backgroundColor,
    borderColor,
}: {
    icon: React.ReactNode;
    controlName: "left" | "right" | "jump" | "attack";
    backgroundColor?: string;
    borderColor?: string;
}) => {
    const { setControl } = useGameInput();

    return (
        <button
            style={{
                fontSize: "28px",
                // reset btn
                background: "transparent",
                padding: "20px",
                margin: "5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                backgroundColor: backgroundColor || "rgba(255,255,255,0.3)",
                border: `2px solid ${borderColor || "white"}`,
            }}
            onPointerDown={() => setControl(controlName, true)}
            onPointerUp={() => setControl(controlName, false)}
            onPointerLeave={() => setControl(controlName, false)}
        >
            {icon}
        </button>
    );
};

