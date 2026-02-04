import { FaLongArrowAltLeft } from "react-icons/fa";
import { useGameInput } from "../../context/game";

function Joystick() {
    const { setControl } = useGameInput();

    return (
        <div
            style={{
                background: "red",
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
            }}
        >
            <button
                onPointerDown={() => setControl("left", true)}
                onPointerUp={() => setControl("left", false)}
                onPointerLeave={() => setControl("left", false)}
            >
                <FaLongArrowAltLeft />
            </button>
        </div>
    );
}

export default Joystick;

