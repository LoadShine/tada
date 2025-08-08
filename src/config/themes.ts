// src/config/themes.ts
export interface ThemeColors {
    primary: string; // HSL string e.g., "3 76% 58%"
    light: string;   // HSL string e.g., "5 100% 89%"
    dark: string;    // HSL string e.g., "3 67% 47%"
}

export interface AppTheme {
    id: string;
    nameKey: string; // Changed from name to nameKey for i18n
    colors: ThemeColors;
}

export const APP_THEMES: AppTheme[] = [
    {
        id: 'default-coral',
        nameKey: 'theme.coralRed',
        colors: {
            primary: '3 76% 58%', // #E34C45
            light: '5 100% 89%',  // #FFCBC7
            dark: '3 67% 47%',    // #C92E27
        },
    },
    {
        id: 'ocean-blue',
        nameKey: 'theme.oceanBlue',
        colors: {
            primary: '207 82% 56%', // #3B82F6 (Tailwind blue-500 like)
            light: '207 90% 88%',   // #BFDBFE (Tailwind blue-200 like)
            dark: '207 90% 40%',    // #1D4ED8 (Tailwind blue-700 like)
        },
    },
    {
        id: 'forest-green',
        nameKey: 'theme.forestGreen',
        colors: {
            primary: '145 63% 40%', // #2F855A (Tailwind green-600 like)
            light: '145 63% 85%',   // #C6F6D5 (Tailwind green-200 like)
            dark: '145 63% 28%',    // #276749 (Tailwind green-800 like)
        },
    },
    {
        id: 'sunset-orange',
        nameKey: 'theme.sunsetOrange',
        colors: {
            primary: '24 94% 51%', // #F97316 (Tailwind orange-500 like)
            light: '24 94% 88%',   // #FED7AA (Tailwind orange-200 like)
            dark: '24 94% 35%',    // #C2410C (Tailwind orange-700 like)
        }
    },
    {
        id: 'royal-purple',
        nameKey: 'theme.royalPurple',
        colors: {
            primary: '262 68% 50%', // #7C3AED (Tailwind violet-600 like)
            light: '262 86% 88%',   // #DDD6FE (Tailwind violet-200 like)
            dark: '262 68% 36%',    // #5B21B6 (Tailwind violet-800 like)
        }
    },
    {
        id: 'graphite-grey',
        nameKey: 'theme.graphiteGrey',
        colors: {
            primary: '210 10% 40%', // #596373 (A neutral grey)
            light: '210 10% 85%',   // #D0D5DB (A lighter neutral grey)
            dark: '210 10% 25%',    // #363D47 (A darker neutral grey)
        }
    }
];


export const PREDEFINED_BACKGROUND_IMAGES: {
    id: string;
    nameKey: string; // Changed from name to nameKey for i18n
    url: string;
    author?: string;
    authorUrl?: string;
    isLight?: boolean
}[] = [
    {id: 'none', nameKey: 'theme.bgNone', url: 'none', isLight: true},
    {
        "id": "brown-grass-sunset",
        "nameKey": "theme.bgBrownGrassSunset",
        "url": "/backgrounds/1.jpg",
        "isLight": true
    },
    {
        "id": "sailboat-on-sea",
        "nameKey": "theme.bgSailboatOnSea",
        "url": "/backgrounds/2.jpg",
        "isLight": true
    },
    {
        "id": "green-grass-field",
        "nameKey": "theme.bgGreenGrassField",
        "url": "/backgrounds/3.jpg",
        "isLight": true
    },
    {
        "id": "snowy-cabin-dawn",
        "nameKey": "theme.bgSnowyCabinDawn",
        "url": "/backgrounds/4.webp",
        "isLight": true
    },
    {
        "id": "burrata-salad-bowl",
        "nameKey": "theme.bgBurrataSaladBowl",
        "url": "/backgrounds/5.png",
        "isLight": true
    },
    {
        "id": "cappadocia-balloons",
        "nameKey": "theme.bgCappadociaBalloons",
        "url": "/backgrounds/6.webp",
        "isLight": true
    },
    {
        "id": "red-orange-poppy",
        "nameKey": "theme.bgRedOrangePoppy",
        "url": "/backgrounds/7.webp",
        "isLight": true
    }
];

export const APP_VERSION = '1.0.1 - UX Refinements';

export const CHANGELOG_HTML = `
<div class="prose prose-sm dark:prose-invert max-w-none text-grey-dark dark:text-neutral-300 font-light leading-normal">
    <h4>Version 1.0.1 - UX Refinements (Current)</h4>
    <ul>
        <li>Enhanced Dark Mode: Added "System" preference option.</li>
        <li>Improved Dark Mode consistency across all components including Calendar, Date Pickers, and Placeholders.</li>
        <li>Switched to local background images for predefined options.</li>
        <li>Fixed button component to correctly handle 'href' attributes for link-like behavior.</li>
        <li>General UI polish and accessibility improvements.</li>
    </ul>
    <h4>Version 1.0.0 - Refined UX</h4>
    <ul>
        <li>Implemented comprehensive Settings Modal:
            <ul>
                <li><strong>Appearance:</strong> Theme color selection, Dark/Light mode, Background image customization.</li>
                <li><strong>Preferences:</strong> Set system language (mock), default due date, priority, and list for new tasks.</li>
                <li><strong>Premium:</strong> Mock premium subscription tiers and status display.</li>
                <li><strong>About:</strong> App version, changelog, privacy/terms links, feedback option.</li>
            </ul>
        </li>
        <li>Enhanced UI with borderless design principles and improved visual consistency.</li>
        <li>Added persistent storage for all settings.</li>
        <li>Improved Radix UI component integration.</li>
    </ul>
    <h4>Version 0.8.0 - AI Summary & Core Features</h4>
    <ul>
        <li>Introduced AI Summary page with filtering and generation capabilities.</li>
        <li>Implemented core task management features.</li>
        <li>Responsive design for desktop and mobile.</li>
        <li>Integrated Jotai for state management.</li>
    </ul>
</div>
`;

export const PRIVACY_POLICY_HTML = `
<div class="prose prose-sm dark:prose-invert max-w-none text-grey-dark dark:text-neutral-300 font-light leading-normal">
    <p><strong>Last Updated: ${new Date().toLocaleDateString()}</strong></p>
    <p>Your privacy is important to us. This Tada application is a demonstration and operates primarily on local storage within your browser. We do not collect or transmit your personal task data to any external servers for storage, beyond what is necessary for any integrated AI features (which would be subject to their own privacy policies, clearly indicated if/when such features are live).</p>
    <h4>Information We Collect (Locally)</h4>
    <ul>
        <li><strong>Task Data:</strong> All tasks, subtasks, notes, due dates, priorities, and tags you create are stored locally in your browser's local storage.</li>
        <li><strong>Settings Data:</strong> Your application preferences, such as theme, dark mode, and default settings, are also stored locally.</li>
    </ul>
    <h4>How We Use Your Information (Locally)</h4>
    <p>Your data is used solely to provide the functionality of this application on your device. It is not used for tracking, advertising, or any other purpose by the application itself.</p>
    <h4>Data Security</h4>
    <p>Since data is stored locally, its security depends on the security of your browser and device. We recommend using up-to-date browser software and securing your device appropriately.</p>
    <h4>Third-Party Services</h4>
    <p>If this application integrates with third-party AI services for features like task analysis or summary generation, data sent to those services will be governed by their respective privacy policies. We will strive to make such integrations transparent.</p>
    <h4>Changes to This Privacy Policy</h4>
    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the application.</p>
    <h4>Contact Us</h4>
    <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@tada-app.example.com" class="text-primary hover:underline">privacy@tada-app.example.com</a>.</p>
</div>
`;

export const TERMS_OF_USE_HTML = `
<div class="prose prose-sm dark:prose-invert max-w-none text-grey-dark dark:text-neutral-300 font-light leading-normal">
    <p><strong>Last Updated: ${new Date().toLocaleDateString()}</strong></p>
    <p>Welcome to Tada! By using this application, you agree to these Terms of Use.</p>
    <h4>1. Use of the Application</h4>
    <p>Tada is provided for personal task management. You are responsible for the data you input and manage within the application. As this is a demonstration application, it is provided "as is" without warranties of any kind.</p>
    <h4>2. Local Data Storage</h4>
    <p>You acknowledge that all your task data and settings are stored locally in your browser. We are not responsible for any loss of data. It is your responsibility to manage backups if desired (e.g., using the app's backup feature if available, or by other means).</p>
    <h4>3. Intellectual Property</h4>
    <p>The application design, UI, and underlying code (excluding third-party libraries) are the property of the application developers. You may not copy, modify, or distribute the application without permission.</p>
    <h4>4. Prohibited Conduct</h4>
    <p>You agree not to use the application for any unlawful purpose or in any way that could damage, disable, or impair the application (though as a local app, impact is primarily to your own instance).</p>
    <h4>5. Disclaimer of Warranties</h4>
    <p>The application is provided "as is" and "as available" without any warranties, express or implied. We do not warrant that the application will be error-free or uninterrupted.</p>
    <h4>6. Limitation of Liability</h4>
    <p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the application.</p>
    <h4>7. Changes to Terms</h4>
    <p>We reserve the right to modify these Terms at any time. We will provide notice of changes by updating the "Last Updated" date and posting the new Terms within the application.</p>
    <h4>8. Governing Law</h4>
    <p>These Terms shall be governed by the laws of [Your Jurisdiction - for a real app, specify this], without regard to its conflict of law provisions.</p>
    <h4>Contact Us</h4>
    <p>If you have any questions about these Terms, please contact us at <a href="mailto:terms@tada-app.example.com" class="text-primary hover:underline">terms@tada-app.example.com</a>.</p>
</div>
`;