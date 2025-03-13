// Header Constants
export const HEADER = {
  COMPANY_NAME: 'SerenGPTy',
  DISCORD_LINK: 'https://discord.gg/BftCHbV4TW',
  GITHUB_LINK: 'https://github.com/enclaveid/serengpty',
  LOGIN_BUTTON_TEXT: 'Login',
};

// Hero Constants
export const HERO = {
  TITLE: 'Find ChatGPT and Claude users who think like you',
  SUBTITLE:
    'Which have gone down your same rabbit holes, are wrestling with the same philosophical questions, are working on similar software projects, or just have the same taste in generating cursed AI art.',
};

// Privacy Section Constants
export const PRIVACY = {
  MAIN_TITLE: {
    FIRST_PART: 'Your data,',
    SECOND_PART: 'Your rules',
  },
  ANONYMITY: {
    TITLE: '100% Anonymous',
    DESCRIPTION: `
    SerenGPTy is does not require any email, phone number, or payment information that could identify you.
    For additional privacy, your data export is thoroughly analyzed and cleaned before it reaches our servers,
    making sure no PIIs are leaked from the contents of your chats.
    `,
    ICON: 'mdi:incognito',
  },
  OPEN_SOURCE: {
    TITLE: 'Free and Open Source',
    DESCRIPTION: `
    SerenGPTy is an experimental, community-owned project with the goal of bringing the world closer together.
    Although data processing costs are currently subsidized, its long-term sustainability depends on active participation from the community.
    Contributions to the codebase and product feedback are thus strongly encouraged!
    `,
    ICON: 'raphael:opensource',
  },
  ZERO_TRUST: {
    TITLE: 'Zero Trust Infrastructure [soon]',
    DESCRIPTION: `
    Even with careful anonymization, there’s still a lot of trust involved when uploading something as personal as private AI conversations.
    In the near future, SerenGPTy will run on Zero Trust infrastructure by leveraging Confidential Containers technology.
    With remote attestation, the whole infrastructure will be fully transparent and verifiable.
    `,
    ICON: 'mdi:shield-lock',
  },
};

// Collaborative Section Constants
export const COLLABORATIVE = {
  TITLE: 'Collaboratively broaden your personal Chains-of-Thought',
  SUBTITLE: `Navigating your own world model is as much of an effort for us humans as it is for AIs, yet differently from AIs we do get frustrated when stuck.
    Sometimes a fresh outside perspective from someone who has walked our same steps is all that's needed.`,
};

// Footer Constants
export const FOOTER = {
  COMPANY_NAME: HEADER.COMPANY_NAME,
  TAGLINE: HERO.TITLE,
  COPYRIGHT: '© {year} EnclaveID. All rights reserved.',
};

// Landing Guidance Steps
export const GUIDANCE_STEPS = [
  {
    text: 'Navigate to chatgpt.com or claude.ai and open Settings',
    imageSrc: '/1.png',
    scale: 1.2,
    objectPosition: 'right top',
  },
  {
    text: "Open 'Data controls' and select 'Export'",
    imageSrc: '/2.png',
    scale: 1,
    objectPosition: 'center top',
  },
  {
    text: "Select 'Confirm export'",
    imageSrc: '/3.png',
    scale: 1,
    objectPosition: 'center',
  },
  {
    text: "Navigate to your inbox and 'Download data export'",
    imageSrc: '/4.png',
    scale: 1.15,
    objectPosition: 'left bottom',
  },
];
