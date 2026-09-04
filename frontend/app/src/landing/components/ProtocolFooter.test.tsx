import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProtocolFooter } from './ProtocolFooter';
import { FRONTERA_SYSTEMS_URL, REPOSITORY_URL } from '../brand';

afterEach(cleanup);

const navigationColumn = () =>
  screen.getByRole('heading', { name: 'Navigation' }).parentElement as HTMLElement;

describe('ProtocolFooter navigation', () => {
  describe('surface="protocol"', () => {
    it('routes the commercial layer to the Frontera Systems site', () => {
      render(<ProtocolFooter accent="amethyst" surface="protocol" />);

      const link = within(navigationColumn()).getByRole('link', { name: 'Frontera Systems' });
      expect(link).toHaveAttribute('href', 'https://frontera-systems.com');
      expect(link).toHaveAttribute('href', FRONTERA_SYSTEMS_URL);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    });

    it('drops the retired Enterprise brand entirely', () => {
      const { container } = render(<ProtocolFooter accent="amethyst" surface="protocol" />);

      expect(screen.queryByRole('link', { name: 'Enterprise' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Soberanía Enterprise/i })).not.toBeInTheDocument();
      expect(container.innerHTML).not.toContain('?view=enterprise');
    });

    it('keeps the rest of the navigation column intact', () => {
      render(<ProtocolFooter accent="amethyst" surface="protocol" />);

      const items = within(navigationColumn())
        .getAllByRole('link')
        .map((link) => link.textContent?.trim());
      expect(items).toEqual(['Frontera Systems', 'Docs', 'About', 'Contact Us', 'GitHub']);
    });
  });

  describe('default surface', () => {
    it('is unchanged unless a surface is explicitly opted into', () => {
      render(<ProtocolFooter accent="sapphire" />);

      const column = navigationColumn();
      expect(within(column).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
        'Enterprise',
        'Docs',
        'About',
        'Contact Us',
        'GitHub',
      ]);
      expect(within(column).getByRole('link', { name: 'Enterprise' })).toHaveAttribute(
        'href',
        '/?view=enterprise',
      );
      expect(within(column).queryByRole('link', { name: 'Frontera Systems' })).not.toBeInTheDocument();
    });

    it('renders identically whether the default is implicit or explicit', () => {
      const implicit = render(<ProtocolFooter accent="sapphire" />).container.innerHTML;
      cleanup();
      const explicit = render(<ProtocolFooter accent="sapphire" surface="default" />).container
        .innerHTML;
      expect(explicit).toBe(implicit);
    });
  });

  describe('every surface', () => {
    it.each(['protocol', 'default'] as const)('points GitHub at the canonical repository (%s)', (surface) => {
      const { container } = render(<ProtocolFooter accent="amethyst" surface={surface} />);

      const github = within(navigationColumn()).getByRole('link', { name: 'GitHub' });
      expect(github).toHaveAttribute('href', 'https://github.com/Republika-Network/Soberania_Protocol');
      expect(github).toHaveAttribute('href', REPOSITORY_URL);
      expect(github).toHaveAttribute('target', '_blank');
      expect(github).toHaveAttribute('rel', 'noreferrer');
      expect(container.innerHTML).not.toContain('Architects-of-Change');
    });
  });
});
