import { Icon } from '@iconify/react';
import Image from 'next/image';
import { Logo } from '@enclaveid/ui/logo';
import { LandingGuidance } from './components/landing/landing-guidance';
import { ZipOnboardingForm } from './components/landing/zip-onboarding-form';
import {
  HEADER,
  HERO,
  PRIVACY,
  FOOTER,
  COLLABORATIVE,
} from './constants/landing-page';
import { LandingButton } from './components/landing-button';
import { Badge } from '@enclaveid/ui/badge';

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <Header />

      {/* Global overlay to blur the background on file drag */}
      {/* <GlobalDragBlurOverlay /> */}
      <main className="flex-grow">
        <Hero />
        <CollaborativeSection />
        <PrivacySection />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 bg-offwhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Company Name */}
          <div className="flex items-center gap-1 font-bold text-xl sm:text-2xl text-content-primary">
            <Logo />
            <span>{HEADER.COMPANY_NAME}</span>
          </div>

          {/* Navigation / Social Icons */}
          <nav className="flex gap-2 sm:gap-4 items-center">
            {/* Desktop version with static tooltip that has animation classes */}
            <div className="hidden sm:block relative">
              <a
                href={HEADER.EXTENSION_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-content-secondary hover:text-content-primary py-1"
              >
                <Badge
                  variant="default"
                  className="text-white mr-2 pointer-events-none"
                >
                  NEW!
                </Badge>
                <Icon
                  icon="simple-icons:googlechrome"
                  className="w-5 h-5 mr-1"
                />
                <span>Extension</span>
              </a>
              <div className="tooltip-auto absolute z-50 bg-popover text-popover-foreground p-2 rounded-md shadow-md text-sm left-1/2 -translate-x-1/2 top-full mt-1 w-max whitespace-nowrap border">
                {HEADER.EXTENSION_TOOLTIP}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-popover border border-b-0 border-r-0"></div>
              </div>
            </div>

            {/* Mobile version - only Chrome icon shown at smaller screens */}
            <div className="flex sm:hidden relative">
              <a
                href={HEADER.EXTENSION_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center"
              >
                <Icon
                  icon="simple-icons:googlechrome"
                  className="w-[18px] h-[18px]"
                />
              </a>
              <div className="tooltip-auto absolute z-50 bg-popover text-popover-foreground p-2 rounded-md shadow-md text-sm left-1/2 -translate-x-1/2 top-full mt-3 w-max whitespace-nowrap border">
                {HEADER.EXTENSION_TOOLTIP}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-popover border border-b-0 border-r-0"></div>
              </div>
            </div>

            <a
              href={HEADER.DISCORD_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-secondary hover:text-content-primary"
            >
              <Icon icon="mdi:discord" className="w-5 h-5 sm:w-6 sm:h-6" />
            </a>
            <a
              href={HEADER.GITHUB_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-secondary hover:text-content-primary"
            >
              <Icon icon="mdi:github" className="w-5 h-5 sm:w-6 sm:h-6" />
            </a>

            <LandingButton />
          </nav>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-offwhite pt-6 sm:pt-12 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 my-10 sm:my-16 md:my-24">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <div className="w-full md:w-1/2 flex flex-col justify-center">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-content-primary">
              {HERO.TITLE}
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6">
              {HERO.SUBTITLE}
            </p>
          </div>

          <ZipOnboardingForm />
        </div>
      </div>

      {/* slanted background */}
      {/* <div
        className="absolute bottom-0 left-0 right-0 md:h-[500px] h-[250px] bg-white"
        style={{
          clipPath: 'polygon(0 100%, 100% 100%, 100% 50%, 0 75%)',
        }}
      /> */}

      {/* Commented out white polygon
      <div
        className="absolute bottom-0 left-0 right-0 md:h-[500px] h-[250px] bg-white"
        style={{
          clipPath: 'polygon(0 100%, 100% 100%, 100% 75%, 0 75%)',
        }}
      />
      */}

      {/* <Image
        src="/arrow-start.svg"
        alt="Arrow start"
        width={100}
        height={100}
        className="absolute bottom-[160px] left-[120px] h-[230px] w-[230px]"
      /> */}

      <LandingGuidance />

      <Image
        src="/arrow-end.svg"
        alt="Arrow end"
        width={100}
        height={100}
        className="absolute 2xl:right-[25%] lg:right-[10%] md:right-[5%] bottom-[200px] h-[150px] w-[150px] hidden md:block"
      />
    </section>
  );
}

function PrivacySection() {
  return (
    <section className="bg-white py-12 sm:py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:hidden">
          {/* Mobile layout - completely restructured for mobile */}
          <div className="flex flex-col gap-8">
            {/* 1. Mobile heading */}
            <div className="flex flex-row">
              <h2 className="text-2xl sm:text-3xl font-bold leading-snug mr-2 opacity-50 text-content-primary">
                {PRIVACY.MAIN_TITLE.FIRST_PART}
              </h2>
              <h2 className="text-2xl sm:text-3xl font-bold leading-snug text-content-primary">
                {PRIVACY.MAIN_TITLE.SECOND_PART}
              </h2>
            </div>

            {/* 2. Images grid - commented out
            <div className="grid grid-cols-2 gap-2 place-items-center">
              <div className="flex items-center w-24 sm:w-32">
                <Image
                  src="/nvtrust.png"
                  alt="NVIDIA nvtrust logo"
                  width={160}
                  height={160}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex items-center w-24 sm:w-32">
                <Image
                  src="/coco.png"
                  alt="Confidential Containers"
                  width={160}
                  height={160}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex items-center w-24 sm:w-32 col-span-2 justify-self-center">
                <Image
                  src="/amd.png"
                  alt="AMD SEV-SNP"
                  width={160}
                  height={160}
                  className="w-full h-auto"
                />
              </div>
            </div>
            */}

            {/* 3. Info blocks */}
            <div className="space-y-6">
              {/* Open Source */}
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-brand mb-2 flex items-center">
                  <Icon
                    icon={PRIVACY.ANONYMITY.ICON}
                    className="mr-3 text-2xl sm:text-3xl"
                  />
                  {PRIVACY.ANONYMITY.TITLE}
                </h3>
                <p className="text-sm sm:text-base text-gray-700">
                  {PRIVACY.ANONYMITY.DESCRIPTION}
                </p>
              </div>

              {/* Community Owned */}
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-brand mb-2 flex items-center">
                  <Icon
                    icon={PRIVACY.OPEN_SOURCE.ICON}
                    className="mr-3 text-2xl sm:text-3xl"
                  />
                  {PRIVACY.OPEN_SOURCE.TITLE}
                </h3>
                <p className="text-sm sm:text-base text-gray-700">
                  {PRIVACY.OPEN_SOURCE.DESCRIPTION}
                </p>
              </div>

              {/* Zero Trust */}
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-brand mb-2 flex items-center">
                  <Icon
                    icon={PRIVACY.ZERO_TRUST.ICON}
                    className="mr-3 text-2xl sm:text-3xl"
                  />
                  {PRIVACY.ZERO_TRUST.TITLE}
                </h3>
                <p className="text-sm sm:text-base text-content-secondary">
                  {PRIVACY.ZERO_TRUST.DESCRIPTION}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop layout - revised with top header and 3-column grid below */}
        <div className="hidden md:flex flex-col gap-20">
          {/* Top row - "Your data, Your rules" heading */}
          <div className="flex justify-center">
            <div className="flex flex-row text-center">
              <h2 className="text-4xl lg:text-5xl font-bold leading-snug mr-3 opacity-50 text-content-primary">
                {PRIVACY.MAIN_TITLE.FIRST_PART}
              </h2>
              <h2 className="text-4xl lg:text-5xl font-bold leading-snug text-content-primary">
                {PRIVACY.MAIN_TITLE.SECOND_PART}
              </h2>
            </div>
          </div>

          {/* Three-column grid for text blocks */}
          <div className="grid grid-cols-3 gap-8">
            {/* Open Source */}
            <div>
              <h3 className="text-xl font-bold text-brand mb-2 flex items-center">
                <Icon
                  icon={PRIVACY.ANONYMITY.ICON}
                  className="mr-3 text-3xl lg:text-4xl"
                />
                {PRIVACY.ANONYMITY.TITLE}
              </h3>
              <p className="text-base text-gray-700">
                {PRIVACY.ANONYMITY.DESCRIPTION}
              </p>
            </div>

            {/* Community Owned */}
            <div>
              <h3 className="text-xl font-bold text-brand mb-2 flex items-center">
                <Icon
                  icon={PRIVACY.OPEN_SOURCE.ICON}
                  className="mr-3 text-3xl lg:text-4xl"
                />
                {PRIVACY.OPEN_SOURCE.TITLE}
              </h3>
              <p className="text-base text-gray-700">
                {PRIVACY.OPEN_SOURCE.DESCRIPTION}
              </p>
            </div>

            {/* Zero Trust */}
            <div>
              <h3 className="text-xl font-bold text-brand mb-2 flex items-center">
                <Icon
                  icon={PRIVACY.ZERO_TRUST.ICON}
                  className="mr-3 text-3xl lg:text-4xl"
                />
                {PRIVACY.ZERO_TRUST.TITLE}
              </h3>
              <p className="text-base text-content-secondary">
                {PRIVACY.ZERO_TRUST.DESCRIPTION}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CollaborativeSection() {
  return (
    <section className="bg-offwhite py-12 sm:py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left side with text */}
          <div className="w-full md:w-1/2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-content-primary">
              {COLLABORATIVE.TITLE}
            </h2>
            <p className="text-base sm:text-lg text-gray-700">
              {COLLABORATIVE.SUBTITLE}
            </p>
          </div>

          {/* Right side with SVG image */}
          <div className="w-full md:w-1/2 flex justify-center md:justify-end mt-8 md:mt-0">
            <Image
              src="/collab-path.svg"
              alt="Collaborative path visualization"
              width={600}
              height={300}
              className="object-contain w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-offwhite text-text">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
        <div className="flex flex-col items-center justify-center w-full">
          {/* Single line footer with copyright - centered on mobile, justified on desktop */}
          <div className="w-full text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between items-center">
              <p className="flex items-center gap-1">
                <span className="text-gray-900 font-medium">
                  {FOOTER.COMPANY_NAME}
                </span>
                <span className="text-gray-600">—</span>
                <span className="text-gray-600">{FOOTER.TAGLINE}</span>
              </p>
              <p className="text-gray-600 mt-1 sm:mt-0">
                {FOOTER.COPYRIGHT.replace(
                  '{year}',
                  new Date().getFullYear().toString()
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
