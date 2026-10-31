import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { LibraryPanel } from './LibraryPanel';

describe('LibraryPanel furniture left category sidebar', { timeout: 20_000 }, () => {
  beforeEach(() => {
    Element.prototype.scrollTo = () => {};
    useProjectStore.getState().load(createEmptyProject());
    useEditorStore.setState({ libraryOpen: true, libraryTab: 'furniture', workspace: 'plan' });
  });

  it('renders the left category rail with By room above By item', () => {
    render(<LibraryPanel isMobile={false} />);
    const rail = screen.getByTestId('library-categories');
    const roomsGroup = within(rail).getByTestId('library-cat-rooms');
    const itemsGroup = within(rail).getByTestId('library-cat-items');

    expect(within(roomsGroup).getByText('By room')).toBeInTheDocument();
    expect(within(itemsGroup).getByText('By item')).toBeInTheDocument();

    // Ensure By room appears above By item in DOM order.
    const pos = roomsGroup.compareDocumentPosition(itemsGroup);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Key room & furniture categories exist.
    expect(screen.getByTestId('lib-cat-room:bedroom')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-room:kitchen')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-room:bathroom')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-item:beds')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-item:storage')).toBeInTheDocument();
  });

  it('shows multi-category items in multiple room and furniture categories', () => {
    render(<LibraryPanel isMobile={false} />);

    // Select Bedroom -> Daybeds & sofa beds shelf appears
    fireEvent.click(screen.getByTestId('lib-cat-room:bedroom'));
    expect(screen.getByTestId('lib-cat-room:bedroom')).toHaveAttribute('aria-pressed', 'true');
    const grid = screen.getByTestId('asset-grid');
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();

    // Select Living room -> Daybeds & sofa beds ALSO appears
    fireEvent.click(screen.getByTestId('lib-cat-room:living'));
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();

    // Select Beds (By item) -> Daybeds & sofa beds ALSO appears
    fireEvent.click(screen.getByTestId('lib-cat-item:beds'));
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();

    // Select Sofas & chairs (By item) -> Daybeds & sofa beds ALSO appears
    fireEvent.click(screen.getByTestId('lib-cat-item:seating'));
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();
  });
});
