"use client"

import { ReactNode } from 'react'

interface SegmentedControlOption {
    value: string
    label: string | ReactNode
}

interface SegmentedControlProps {
    options: SegmentedControlOption[]
    value: string
    onChange: (value: string) => void
    variant?: 'default' | 'pill'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    fullWidth?: boolean
}

/**
 * SegmentedControl - Componente padronizado de tabs/segmented control
 * 
 * @example
 * <SegmentedControl
 *   options={[
 *     { value: 'tab1', label: 'Tab 1' },
 *     { value: 'tab2', label: 'Tab 2' },
 *   ]}
 *   value={activeTab}
 *   onChange={setActiveTab}
 * />
 */
export function SegmentedControl({
    options,
    value,
    onChange,
    variant = 'default',
    size = 'md',
    className = '',
    fullWidth = true,
}: SegmentedControlProps) {
    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-3 py-2.5 text-sm sm:px-6 sm:text-base',
    }

    const containerClasses = {
        default: 'rounded-integrallys-lg',
        pill: 'rounded-full',
    }

    const buttonClasses = {
        default: 'rounded-[12px]',
        pill: 'rounded-full',
    }

    return (
        <div
            className={`
        bg-app-bg-secondary dark:bg-app-card-dark p-1 
        flex flex-nowrap gap-1 
        overflow-x-auto scrollbar-hide
        ${containerClasses[variant]}
        ${fullWidth ? 'w-full' : 'inline-flex'}
        ${className}
      `}
        >
            {options.map((option) => (
                <button
                    type="button"
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`
            flex-1 min-w-fit shrink-0 whitespace-nowrap transition-all font-normal
            ${buttonClasses[variant]}
            ${sizeClasses[size]}
            ${value === option.value
                            ? 'bg-app-primary text-white shadow-md'
                            : 'text-app-text-secondary dark:text-white/60 hover:bg-app-bg-secondary dark:hover:bg-app-hover'
                        }
          `}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
