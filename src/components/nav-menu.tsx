'use client';

import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  subItems?: {
    href: string;
    label: string;
  }[];
}

interface NavMenuProps {
  items: NavItem[];
  pathname: string;
  isMobile?: boolean;
}

export function NavMenu({ items, pathname, isMobile = false }: NavMenuProps) {
  if (isMobile) {
    return (
      <Accordion type="multiple" className="w-full">
        {items.map((item) => {
          const isActive = item.subItems
            ? pathname.startsWith(item.href)
            : pathname === item.href;
          
          if (!item.subItems) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground',
                  isActive && 'text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          }

          return (
            <AccordionItem value={item.href} key={item.href} className="border-b-0">
              <AccordionTrigger
                className={cn(
                  'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground hover:no-underline',
                  isActive && 'text-foreground'
                )}
              >
                <div className="flex items-center gap-4">
                    <item.icon className="h-5 w-5" />
                    {item.label}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8">
                <div className="flex flex-col gap-4 mt-2">
                    {item.subItems.map((subItem) => (
                        <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn(
                                'text-muted-foreground hover:text-foreground',
                                pathname === subItem.href && 'text-foreground font-semibold'
                            )}
                        >
                            {subItem.label}
                        </Link>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  }

  return (
    <TooltipProvider>
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);

        if (!item.subItems || item.subItems.length === 0) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return (
          <DropdownMenu key={item.href}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="icon"
                    className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                        isActive && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start">
              {item.subItems.map((subItem) => (
                <DropdownMenuItem key={subItem.href} asChild>
                  <Link href={subItem.href}>{subItem.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </TooltipProvider>
  );
}
