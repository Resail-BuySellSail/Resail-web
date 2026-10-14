import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import ImageCropModal from './ImageCropModal';

const { screen, userEvent } = testingLibrary;

const imageFile = name => new File(['hello'], name, { type: 'image/png' });

describe('ImageCropModal', () => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  const originalResizeObserver = window.ResizeObserver;

  beforeAll(() => {
    let count = 0;
    window.URL.createObjectURL = jest.fn(() => `blob:photo-${(count += 1)}`);
    window.URL.revokeObjectURL = jest.fn();
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  afterAll(() => {
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    window.ResizeObserver = originalResizeObserver;
  });

  const renderModal = props =>
    render(
      <ImageCropModal
        aspectWidth={1}
        aspectHeight={1}
        onManageDisableScrolling={() => null}
        {...props}
      />,
      { withPortals: true }
    );

  it('shows all selected photos and uploads skipped photos as they are, in order', async () => {
    const user = userEvent.setup();
    const files = [imageFile('one.png'), imageFile('two.png')];
    const onComplete = jest.fn();
    renderModal({ files, onComplete });

    expect(screen.getAllByRole('img', { name: /ImageCropModal.thumbnailAlt/ })).toHaveLength(2);
    // Cropping needs a crop area from the cropper first
    expect(screen.getByRole('button', { name: 'ImageCropModal.cropAndNext' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'ImageCropModal.skipAndNext' }));
    expect(onComplete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ImageCropModal.skip' }));
    expect(onComplete).toHaveBeenCalledWith(files);
  });

  it('uploads the photos handled so far when the modal is closed', async () => {
    const user = userEvent.setup();
    const files = [imageFile('one.png'), imageFile('two.png'), imageFile('three.png')];
    const onComplete = jest.fn();
    renderModal({ files, onComplete });

    await user.click(screen.getByRole('button', { name: 'ImageCropModal.skipAndNext' }));
    await user.click(screen.getByTitle('Modal.closeModal'));

    expect(onComplete).toHaveBeenCalledWith([files[0]]);
  });
});
