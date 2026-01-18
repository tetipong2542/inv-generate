import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="w-full py-2 sm:py-4 overflow-x-auto">
      <div className="flex items-center justify-between min-w-max sm:min-w-0">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => onStepClick?.(index)}
                disabled={!onStepClick}
                className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-200",
                  index < currentStep && "bg-primary text-primary-foreground",
                  index === currentStep && "bg-primary text-primary-foreground ring-2 sm:ring-4 ring-primary/20",
                  index > currentStep && "bg-muted text-muted-foreground",
                  onStepClick && index <= currentStep && "cursor-pointer hover:ring-4 hover:ring-primary/20"
                )}
              >
                {index < currentStep ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  step.id
                )}
              </button>
              <div className="mt-1 sm:mt-2 text-center">
                <p className={cn(
                  "text-xs sm:text-sm font-medium whitespace-nowrap",
                  index === currentStep ? "text-primary" : "text-muted-foreground"
                )}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2 sm:mx-4 min-w-4 sm:min-w-8">
                <div className={cn(
                  "h-0.5 sm:h-1 rounded-full transition-all duration-200",
                  index < currentStep ? "bg-primary" : "bg-muted"
                )} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
