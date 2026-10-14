import React from 'react';
import '@testing-library/jest-dom';
import { Form as FinalForm, Field } from 'react-final-form';
import arrayMutators from 'final-form-arrays';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingPhotosForm, { FieldAddImage } from './EditListingPhotosForm';

const { screen, userEvent, waitFor, act, fireEvent } = testingLibrary;

const noop = () => null;

describe('EditListingDeliveryForm', () => {
  it('matches snapshot', () => {
    const saveActionMsg = 'Save photos';
    const tree = render(
      <EditListingPhotosForm
        initialValues={{ country: 'US', images: [] }}
        intl={fakeIntl}
        dispatch={noop}
        onImageUpload={v => Promise.reject(v)}
        onSubmit={v => v}
        saveActionMsg={saveActionMsg}
        stripeConnected={false}
        updated={false}
        ready={false}
        updateInProgress={false}
        disabled={false}
        onRemoveImage={noop}
        listingImageConfig={{ aspectWidth: 1, aspectHeight: 1, variantPrefix: 'listing-card' }}
        allFilesUploadedAndVerified={true}
      />
    );
    expect(tree.asFragment()).toMatchSnapshot();
  });

  // TODO to test this fully, we would need to check that store's state changes correctly.

  const imageFile = name => new File(['hello'], name, { type: 'image/png' });

  const renderFieldAddImage = (onFilesSelected, { disabled = false } = {}) =>
    render(
      <FinalForm
        onSubmit={noop}
        mutators={{ ...arrayMutators }}
        render={() => (
          <form onSubmit={noop}>
            <FieldAddImage
              id="addImage"
              name="addImage"
              accept="image/*"
              label={<div>label</div>}
              type="file"
              disabled={disabled}
              formApi={{ change: noop, blur: noop }}
              onFilesSelected={onFilesSelected}
              aspectWidth={1}
              aspectHeight={1}
            />
          </form>
        )}
      />
    );

  describe('FieldAddImage', () => {
    it('hands every picked file over for cropping at once', async () => {
      const user = userEvent.setup();
      const onFilesSelected = jest.fn();
      renderFieldAddImage(onFilesSelected);

      const input = screen.getByLabelText(/label/i);
      expect(input).toHaveAttribute('multiple');

      const files = [imageFile('one.png'), imageFile('two.png'), imageFile('three.png')];
      await user.upload(input, files);

      expect(onFilesSelected).toHaveBeenCalledTimes(1);
      expect(onFilesSelected).toHaveBeenCalledWith(files);
    });

    it('clears the input so the same file can be picked again', async () => {
      const user = userEvent.setup();
      const onFilesSelected = jest.fn();
      renderFieldAddImage(onFilesSelected);

      const input = screen.getByLabelText(/label/i);
      const file = imageFile('one.png');

      await user.upload(input, file);
      await user.upload(input, file);

      // Without clearing, the second pick of an identical file fires no change event at all.
      expect(onFilesSelected).toHaveBeenCalledTimes(2);
    });

    it('hands over files dropped onto the tile', () => {
      const onFilesSelected = jest.fn();
      const { container } = renderFieldAddImage(onFilesSelected);

      const dropZone = container.querySelector('form > div');
      const files = [imageFile('one.png'), imageFile('two.png')];

      fireEvent.drop(dropZone, { dataTransfer: { files } });

      expect(onFilesSelected).toHaveBeenCalledWith(files);
    });

    it('ignores dropped files that are not images', () => {
      const onFilesSelected = jest.fn();
      const { container } = renderFieldAddImage(onFilesSelected);

      const dropZone = container.querySelector('form > div');
      const notAnImage = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });

      fireEvent.drop(dropZone, { dataTransfer: { files: [notAnImage] } });

      expect(onFilesSelected).not.toHaveBeenCalled();
    });

    it('ignores drops while an upload is already running', () => {
      const onFilesSelected = jest.fn();
      const { container } = renderFieldAddImage(onFilesSelected, { disabled: true });

      const dropZone = container.querySelector('form > div');

      fireEvent.drop(dropZone, { dataTransfer: { files: [imageFile('one.png')] } });

      expect(onFilesSelected).not.toHaveBeenCalled();
    });
  });
});
