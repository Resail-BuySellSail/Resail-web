import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { required } from '../../util/validators';
import { US_COUNTRY } from '../../util/shipping';
import getUsaStates from '../../translations/usaStates';

// Import shared components
import {
  Form,
  FieldPhoneNumberInput,
  FieldSelect,
  FieldTextInput,
  PrimaryButton,
} from '../../components';

// Import modules from this directory
import css from './ShippingAddressForm.module.css';

/**
 * US-only shipping address form. Country is always US.
 * Address shape: { name, phone, street1, streetNo, city, state, zip, country }
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {string} [props.formId] - The form id
 * @param {Object} [props.initialValues] - Saved shipping address
 * @param {Function} props.onSubmit - The submit function
 * @param {string} [props.submitButtonText] - The submit button text
 * @param {boolean} [props.inProgress] - Whether the submit is in progress
 * @param {propTypes.error} [props.saveAddressError] - Error from saving the address
 * @returns {JSX.Element} ShippingAddressForm component
 */
const ShippingAddressForm = props => {
  const intl = useIntl();
  const { initialValues, ...restProps } = props;

  return (
    <FinalForm
      {...restProps}
      initialValues={{ ...initialValues, country: US_COUNTRY }}
      render={formRenderProps => {
        const {
          className,
          rootClassName,
          formId = 'ShippingAddressForm',
          handleSubmit,
          invalid,
          inProgress,
          submitButtonText,
          saveAddressError,
        } = formRenderProps;

        const classes = classNames(rootClassName || css.root, className);
        const requiredValidator = messageId => required(intl.formatMessage({ id: messageId }));
        const optionalText = intl.formatMessage({ id: 'ShippingAddressForm.optionalText' });
        const usaStates = getUsaStates();

        return (
          <Form className={classes} onSubmit={handleSubmit}>
            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.name`}
                className={css.field}
                type="text"
                name="name"
                autoComplete="name"
                label={intl.formatMessage({ id: 'ShippingAddressForm.nameLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.namePlaceholder' })}
                validate={requiredValidator('ShippingAddressForm.nameRequired')}
              />
              <FieldPhoneNumberInput
                id={`${formId}.phone`}
                className={css.field}
                name="phone"
                autoComplete="tel"
                label={intl.formatMessage({ id: 'ShippingAddressForm.phoneLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.phonePlaceholder' })}
                validate={requiredValidator('ShippingAddressForm.phoneRequired')}
              />
            </div>

            <FieldTextInput
              id={`${formId}.street1`}
              className={css.field}
              type="text"
              name="street1"
              autoComplete="address-line1"
              label={intl.formatMessage({ id: 'ShippingAddressForm.streetLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingAddressForm.streetPlaceholder' })}
              validate={requiredValidator('ShippingAddressForm.streetRequired')}
            />
            <FieldTextInput
              id={`${formId}.streetNo`}
              className={css.field}
              type="text"
              name="streetNo"
              autoComplete="address-line2"
              label={intl.formatMessage({ id: 'ShippingAddressForm.aptLabel' }, { optionalText })}
              placeholder={intl.formatMessage({ id: 'ShippingAddressForm.aptPlaceholder' })}
            />

            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.city`}
                className={css.field}
                type="text"
                name="city"
                autoComplete="address-level2"
                label={intl.formatMessage({ id: 'ShippingAddressForm.cityLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.cityPlaceholder' })}
                validate={requiredValidator('ShippingAddressForm.cityRequired')}
              />
              <FieldSelect
                id={`${formId}.state`}
                className={css.field}
                name="state"
                autoComplete="address-level1"
                label={intl.formatMessage({ id: 'ShippingAddressForm.stateLabel' })}
                validate={requiredValidator('ShippingAddressForm.stateRequired')}
              >
                <option disabled value="">
                  {intl.formatMessage({ id: 'ShippingAddressForm.statePlaceholder' })}
                </option>
                {usaStates.map(state => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.zip`}
                className={css.field}
                type="text"
                name="zip"
                autoComplete="postal-code"
                label={intl.formatMessage({ id: 'ShippingAddressForm.zipLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.zipPlaceholder' })}
                validate={requiredValidator('ShippingAddressForm.zipRequired')}
              />
              <FieldTextInput
                id={`${formId}.country`}
                className={css.field}
                type="text"
                name="country"
                label={intl.formatMessage({ id: 'ShippingAddressForm.countryLabel' })}
                readOnly
              />
            </div>

            {saveAddressError ? (
              <p className={css.error}>
                <FormattedMessage id="ShippingAddressForm.saveFailed" />
              </p>
            ) : null}

            <PrimaryButton
              className={css.submitButton}
              type="submit"
              inProgress={inProgress}
              disabled={invalid || inProgress}
            >
              {submitButtonText || intl.formatMessage({ id: 'ShippingAddressForm.submit' })}
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

export default ShippingAddressForm;
