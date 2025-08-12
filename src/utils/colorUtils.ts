// src/utils/colorUtils.ts
interface GradientColorSet {
    gradient: string;
    textHsl: string;
}

/**
 * Generates a consistent, aesthetically pleasing conic gradient and text color
 * based on a string input (e.g., a username).
 * @param name The input string, typically a username.
 * @returns An object containing a CSS gradient string and an HSL text color string.
 */
export const generateColorFromName = (name: string): GradientColorSet => {
    if (!name) {
        // Default fallback color if name is empty
        return {
            gradient: 'conic-gradient(from 0deg, hsl(220, 20%, 90%), hsl(220, 20%, 85%), hsl(220, 20%, 90%))', // Light grey gradient
            textHsl: '220 20% 30%', // Dark grey
        };
    }

    // Simple hash function to generate a number from the string
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const charCode = name.charCodeAt(i);
        hash = (hash << 5) - hash + charCode;
        hash |= 0; // Convert to 32bit integer
    }

    // Generate four harmonious hues for the gradient, spanning a 90-degree arc on the color wheel
    const baseHue = Math.abs(hash % 360);
    const hue2 = (baseHue + 30) % 360;
    const hue3 = (baseHue + 60) % 360;
    const hue4 = (baseHue + 90) % 360;

    // Use vibrant but light saturation and lightness for a dreamy, pastel feel
    const saturation = 90;
    const lightness = 88;

    const color1 = `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
    const color2 = `hsl(${hue2}, ${saturation}%, ${lightness}%)`;
    const color3 = `hsl(${hue3}, ${saturation}%, ${lightness}%)`;
    const color4 = `hsl(${hue4}, ${saturation}%, ${lightness}%)`;

    // A darker, readable text color derived from the base hue
    const textSaturation = 60;
    const textLightness = 25;

    return {
        // Use a conic-gradient for a smooth, rotating effect. Repeat the first color at the end for a seamless loop.
        gradient: `conic-gradient(from 0deg, ${color1}, ${color2}, ${color3}, ${color4}, ${color1})`,
        textHsl: `${baseHue}, ${textSaturation}%, ${textLightness}%`,
    };
};