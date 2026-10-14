import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import loadable from '@loadable/component';

import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { getCroppedFile } from '../../../../util/cropImage';

import { Button, SecondaryButton, Modal } from '../../../../components';

// The cropper's own styles. Global (non-module) CSS, so its class names stay intact.
import 'react-easy-crop/react-easy-crop.css';
import css from './ImageCropModal.module.css';

// Split out of the main bundle - only fetched once someone actually picks a photo.
const Cropper = loadable(() => import(/* webpackChunkName: "react-easy-crop" */ 'react-easy-crop'));

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;

const INITIAL_CROP = { x: 0, y: 0 };

/**
 * Walks the user through the selected photos one at a time. Each photo can be cropped to the
 * listing image aspect ratio, or skipped to use it as it is.
 *
 * Photos picked or dropped together arrive as a queue: all of them are shown as thumbnails, and
 * they're handled in the order they were chosen (which is also the order they'll be uploaded, so
 * the first one stays the cover image). The whole batch is reported back once the last photo is
 * done. Closing early is not an error - the photos already handled still get uploaded, and the
 * rest are dropped.
 *
 * @component
 * @param {Object} props
 * @param {Array<File>} props.files - The photos waiting to be cropped
 * @param {number} props.aspectWidth - Aspect ratio width from the listing image config
 * @param {number} props.aspectHeight - Aspect ratio height from the listing image config
 * @param {Function} props.onComplete - Called with the files to upload (cropped or original), in order
 * @param {Function} props.onManageDisableScrolling - Scroll lock handler for the Modal
 * @returns {JSX.Element}
 */
const ImageCropModal = props => {
  const {
    files,
    aspectWidth = 1,
    aspectHeight = 1,
    onComplete,
    onManageDisableScrolling = () => null,
  } = props;
  const intl = useIntl();

  const [index, setIndex] = useState(0);
  const [crop, setCrop] = useState(INITIAL_CROP);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Handled photos live in a ref: the handlers that finish the queue run after an async
  // encode, and would otherwise read a stale array.
  const resultsRef = useRef([]);

  // Object URLs for all the photos of the batch (thumbnails and the cropper).
  // They're released when the batch changes or the modal unmounts.
  const imageUrls = useMemo(() => files.map(file => window.URL.createObjectURL(file)), [files]);
  useEffect(() => () => imageUrls.forEach(url => window.URL.revokeObjectURL(url)), [imageUrls]);

  const isOpen = files.length > 0;

  // Modal renders its children into a portal element that it only attaches to the
  // document *after* they have mounted, and keeps them display:none while closed.
  // The cropper measures its container once on mount and deliberately ignores the
  // first resize that follows, so mounting it any earlier leaves it with a crop box
  // sized from a hidden element. Holding it back until the viewport reports a real
  // size covers both the attach and the un-hide, in whichever order they land.
  const viewportRef = useRef(null);
  const [viewportReady, setViewportReady] = useState(false);
  useEffect(() => {
    const node = viewportRef.current;
    if (!isOpen || !node) {
      setViewportReady(false);
      return undefined;
    }
    // Start every batch from an untouched crop. The cropper emits one last clamped
    // position as it unmounts, which would otherwise frame the first photo of this
    // batch the way the last photo of the previous one was left.
    setCrop(INITIAL_CROP);
    setZoom(MIN_ZOOM);
    setCroppedAreaPixels(null);
    setError(null);

    const measure = () => setViewportReady(node.clientWidth > 0 && node.clientHeight > 0);
    measure();
    const observer = new window.ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen]);

  const file = files[index];
  const imageUrl = imageUrls[index];
  const total = files.length;
  const isLast = index === total - 1;

  const resetCropControls = () => {
    setCrop(INITIAL_CROP);
    setZoom(MIN_ZOOM);
    setCroppedAreaPixels(null);
    setError(null);
  };

  // The modal stays mounted between batches so that opening it flips Modal's isOpen
  // (which is what arms the scroll lock and the inert page behind it). That makes
  // resetting the queue position on the way out this component's job.
  const finish = () => {
    const handledFiles = resultsRef.current;
    resultsRef.current = [];
    resetCropControls();
    setIndex(0);
    onComplete(handledFiles);
  };

  const addAndContinue = handledFile => {
    resultsRef.current = [...resultsRef.current, handledFile];
    if (isLast) {
      finish();
    } else {
      resetCropControls();
      setIndex(current => current + 1);
    }
  };

  const handleCrop = () => {
    if (!croppedAreaPixels || isProcessing) {
      return;
    }
    setIsProcessing(true);
    getCroppedFile(file, croppedAreaPixels)
      .then(croppedFile => {
        setIsProcessing(false);
        addAndContinue(croppedFile);
      })
      .catch(() => {
        // Keep the photo on screen so the crop can be retried or skipped.
        setIsProcessing(false);
        setError('cropFailed');
      });
  };

  // Skipping uses the photo as it is
  const handleSkip = () => {
    if (isProcessing) {
      return;
    }
    addAndContinue(file);
  };

  const zoomLabel = intl.formatMessage({ id: 'ImageCropModal.zoom' });

  return (
    <Modal
      id="ImageCropModal"
      isOpen={isOpen}
      onClose={finish}
      onManageDisableScrolling={onManageDisableScrolling}
      containerClassName={css.modalContainer}
      closeButtonMessage={intl.formatMessage({ id: 'ImageCropModal.close' })}
      usePortal
    >
      <div className={css.content}>
        <h2 className={css.title}>
          <FormattedMessage id="ImageCropModal.title" />
        </h2>
        <p className={css.progress}>
          {total > 1 ? (
            <FormattedMessage id="ImageCropModal.progress" values={{ current: index + 1, total }} />
          ) : (
            <FormattedMessage id="ImageCropModal.instructions" />
          )}
        </p>

        {total > 1 ? (
          <ol className={css.thumbnails}>
            {imageUrls.map((url, i) => (
              <li
                key={url}
                className={classNames(css.thumbnail, {
                  [css.thumbnailCurrent]: i === index,
                  [css.thumbnailDone]: i < index,
                })}
                aria-current={i === index ? 'step' : undefined}
              >
                <img
                  className={css.thumbnailImage}
                  src={url}
                  alt={intl.formatMessage(
                    { id: 'ImageCropModal.thumbnailAlt' },
                    { current: i + 1, total }
                  )}
                />
              </li>
            ))}
          </ol>
        ) : null}

        <div className={css.cropViewport} ref={viewportRef}>
          {imageUrl && viewportReady ? (
            <Cropper
              key={index}
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              aspect={aspectWidth / aspectHeight}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(croppedArea, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              showGrid
            />
          ) : null}
        </div>

        <label className={css.zoomControl} htmlFor="ImageCropModal-zoom">
          <span className={css.zoomLabel}>{zoomLabel}</span>
          <input
            id="ImageCropModal-zoom"
            className={css.zoomSlider}
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            aria-label={zoomLabel}
            onChange={e => setZoom(Number(e.target.value))}
          />
        </label>

        {error ? (
          <p className={css.error}>
            <FormattedMessage id="ImageCropModal.cropFailed" />
          </p>
        ) : null}

        <div className={css.actions}>
          <SecondaryButton type="button" onClick={handleSkip} disabled={isProcessing}>
            <FormattedMessage id={isLast ? 'ImageCropModal.skip' : 'ImageCropModal.skipAndNext'} />
          </SecondaryButton>
          <Button
            type="button"
            onClick={handleCrop}
            disabled={!croppedAreaPixels}
            inProgress={isProcessing}
          >
            <FormattedMessage id={isLast ? 'ImageCropModal.crop' : 'ImageCropModal.cropAndNext'} />
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImageCropModal;
