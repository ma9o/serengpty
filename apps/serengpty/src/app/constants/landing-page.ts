// Header Constants
export const HEADER = {
  COMPANY_NAME: 'SerenGPTy',
  DISCORD_LINK: 'https://discord.gg/3BHPkHDs',
  GITHUB_LINK: 'https://github.com/enclaveid/enclaveid',
  LOGIN_BUTTON_TEXT: 'Login',
};

// Hero Constants
export const HERO = {
  TITLE: 'Find similar ChatGPT users, anonymously',
  SUBTITLE:
    'That have gone down your same rabbit holes, are exploring the same philosophical questions, or are even just working out the exact same coding problems!',
};

// Privacy Section Constants
export const PRIVACY = {
  MAIN_TITLE: {
    FIRST_PART: 'Your data,',
    SECOND_PART: 'Your rules',
  },
  ANONYMITY: {
    TITLE: '100% Anonymous',
    DESCRIPTION:
      'Every single component of EnclaveID is publicly available on GitHub and the build pipeline is fully reproducible. Thanks to remote attestation, this means that you can trust that whatever is in the code is what is running in our Kubernetes cluster, much like an Ethereum smart contract.',
    ICON: 'mdi:incognito',
  },
  OPEN_SOURCE: {
    TITLE: 'Free and Open Source',
    DESCRIPTION:
      'EnclaveID is a community-owned project with the goal of empowering individuals for a flourishing democratic society. Our code is a reflection of the will of such individuals, so contributions and feedback are strongly encouraged!',
    ICON: 'raphael:opensource',
  },
  ZERO_TRUST: {
    TITLE: 'Zero Trust Infrastructure [soon!]',
    DESCRIPTION:
      'EnclaveID runs on AMD SEV-SNP capable hardware – hence "enclave" in the name – which guarantees that your data is inaccessible by any other software or human (except you), even by the infrastructure provider!',
    ICON: 'mdi:shield-lock',
  },
};

// Collaborative Section Constants
export const COLLABORATIVE = {
  TITLE: 'Collaborative chain of thought',
  SUBTITLE: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae justo ac magna vestibulum ultricies.',
};

// Footer Constants
export const FOOTER = {
  COMPANY_NAME: 'SerenGPTy',
  TAGLINE: 'Find similar ChatGPT users, anonymously',
  COPYRIGHT: '© {year} EnclaveID. All rights reserved.',
};

// Landing Guidance Steps
export const GUIDANCE_STEPS = [
  {
    text: 'Navigate to chatgpt.com and open Settings',
    imageSrc: '/1.png',
    scale: 1.2,
    objectPosition: 'right top',
  },
  {
    text: "Click 'Data controls' and 'Export'",
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
