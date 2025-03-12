import Image from 'next/image';
import { Icon } from '@iconify/react';
import React from 'react';
import { Card, CardContent } from '@enclaveid/ui/card';
import { GUIDANCE_STEPS } from '../../constants/landing-page';

export function LandingGuidance() {
  return (
    <Card className="max-w-7xl mx-auto relative overflow-x-auto mx-5 sm:mx-auto">
      <CardContent className="py-4 px-2 md:px-4">
        <div className="flex flex-col items-center">
          {/* Mobile View (shown only on small screens) */}
          <div className="flex flex-col items-center space-y-6 px-2 md:hidden">
            {GUIDANCE_STEPS.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="w-64 h-32 relative overflow-hidden rounded-lg">
                  <Image
                    src={step.imageSrc}
                    alt={step.text}
                    fill
                    className="object-cover"
                    style={{
                      transform: `scale(${step.scale})`,
                      transformOrigin: step.objectPosition,
                      objectPosition: step.objectPosition,
                      filter: 'brightness(1.15)',
                    }}
                  />
                </div>
                <div className="text-center text-gray-600 mt-2 w-64 mb-2">
                  <p>{step.text}</p>
                </div>
                {/* No arrows in mobile version */}
              </div>
            ))}
          </div>

          {/* Desktop view - horizontal layout (hidden on mobile) */}
          <div className="hidden md:block">
            {/* Row: Images and Arrows */}
            <div className="flex items-center justify-center gap-4">
              {GUIDANCE_STEPS.map((step, index) => (
                <React.Fragment key={index}>
                  <div className="w-64 h-32 relative overflow-hidden rounded-lg">
                    <Image
                      src={step.imageSrc}
                      alt={step.text}
                      fill
                      className="object-cover"
                      style={{
                        transform: `scale(${step.scale})`,
                        transformOrigin: step.objectPosition,
                        objectPosition: step.objectPosition,
                        filter: 'brightness(1.15)',
                      }}
                    />
                  </div>
                  {index < GUIDANCE_STEPS.length - 1 && (
                    <div className="flex items-center justify-center">
                      <Icon icon="material-symbols:arrow-forward-ios-rounded" className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
            {/* Row: Texts */}
            <div className="flex items-center justify-center gap-4 mt-4">
              {GUIDANCE_STEPS.map((step, index) => (
                <React.Fragment key={index}>
                  <div className="w-64 text-center text-gray-600">
                    <p>{step.text}</p>
                  </div>
                  {index < GUIDANCE_STEPS.length - 1 && (
                    <div className="w-8" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
