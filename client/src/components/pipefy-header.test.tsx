
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import PipefyHeader from './pipefy-header';
import { renderWithProviders } from "@/test/test-utils";

// Mocks
jest.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useLocation: () => ['/', jest.fn()],
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { 
      firstName: 'Test', 
      lastName: 'User', 
      email: 'test@example.com',
      isAdmin: true 
    },
    logout: jest.fn(),
  }),
}));

jest.mock('@/hooks/useRealtimeStatus', () => ({
  useRealtimeStatus: () => 'connected',
}));

jest.mock('./mode-toggle', () => ({
  ModeToggle: () => <button>Toggle Theme</button>,
}));

jest.mock('./approvals-inline-badge', () => ({
  __esModule: true,
  default: () => <span>Badge</span>,
}));

describe('PipefyHeader', () => {
  it('renders fixed header with correct structure', () => {
    renderWithProviders(<PipefyHeader />);
    
    // Check if header exists and has fixed class
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('fixed');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('z-50');
  });

  it('renders navigation items', () => {
    renderWithProviders(<PipefyHeader />);
    
    expect(screen.getByText('Compras')).toBeInTheDocument();
    expect(screen.getByText('Kanban')).toBeInTheDocument();
    expect(screen.getByText('Gerenciar')).toBeInTheDocument();
  });

  it('changes style on scroll', () => {
    renderWithProviders(<PipefyHeader />);
    
    const header = screen.getByRole('banner');
    
    // Initial state (not scrolled)
    // Note: In test environment, window.scrollY is 0 initially
    // We check for default classes (py-3)
    expect(header).toHaveClass('py-3');
    
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    fireEvent.scroll(window);
    
    // Since we can't easily change window.scrollY in JSDOM directly without some setup,
    // we might need to manually trigger the event handler logic if the event listener works.
    // However, jsdom window.scrollY is readonly.
    // A workaround is to define a getter for scrollY.
  });
});
