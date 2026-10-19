// Colours, lighting and look-and-feel. Loaded before the game starts.
// The 3D scene uses 0xRRGGBB numbers; the menus use CSS colour strings.

// ---- Sky and fog ----
export const SKY_COLOR = 0x87ceeb;
export const FOG_COLOR = 0x87ceeb;
export const FOG_NEAR = 40;              // fog starts this many blocks away
export const FOG_FAR = 120;              // and is solid here
export const VIEW_DISTANCE = 200;        // nothing further than this is drawn

// ---- Lighting ----
// Intensity 1 means full brightness. SUN_DIRECTION points toward the sun;
// faces turned away from it only receive ambient light.
export const AMBIENT_COLOR = 0xffffff;
export const AMBIENT_INTENSITY = 0.6;
export const SUN_COLOR = 0xffffff;
export const SUN_INTENSITY = 0.5;
export const SUN_DIRECTION = [0.4, 1, 0.6];

// ---- Camera and rendering ----
export const FOV = 75;
export const THIRD_PERSON_DISTANCE = 4;
export const MAX_PIXEL_RATIO = 2;        // lower this on slow devices
export const ANTIALIAS = false;

// ---- Block outline and name tags ----
export const SELECTION_COLOR = 0x000000;
export const SELECTION_OPACITY = 0.6;
export const NAME_TAG_FONT = '20px monospace';
export const NAME_TAG_TEXT = '#ffffff';
export const NAME_TAG_BACKGROUND = 'rgba(0, 0, 0, 0.5)';

// ---- Menu and HUD colours (become CSS variables named --key) ----
export const UI = {
    'page': '#87ceeb',
    'text': '#ffffff',
    'overlay': 'rgba(20, 16, 12, 0.75)',
    'panel': '#5a4129',
    'panel-border': '#2b1d10',
    'button': '#6b6b6b',
    'button-hover': '#7d86d6',
    'button-border': '#1e1e1e',
    'input': '#111111',
    'input-border': '#555555',
    'row': 'rgba(0, 0, 0, 0.35)',
    'error': '#ffb3b3',
    'accent': '#ffe066',
    'slot': 'rgba(0, 0, 0, 0.5)',
    'slot-border': '#555555',
    'slot-selected': '#ffffff',
};

for (const [name, value] of Object.entries(UI)) {
    document.documentElement.style.setProperty('--' + name, value);
}
