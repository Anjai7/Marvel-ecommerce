import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { SimpleTooltip } from "./ui";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 350);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  return (
    <SimpleTooltip content="Return to Top">
      <button
        className="scroll-to-top-btn"
        id="scroll-to-top-btn"
        onClick={scrollToTop}
        aria-label="Return to top of page"
      >
        <ArrowUp size={20} strokeWidth={2.5} />
      </button>
    </SimpleTooltip>
  );
}
