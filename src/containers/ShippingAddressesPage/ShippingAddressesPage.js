import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';

// Import contexts and util modules
import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { parse } from '../../util/urlHelpers';
import {
  SHIP_FROM_ADDRESS,
  SHIP_TO_ADDRESS,
  SHIPPING_ADDRESS_TYPES,
  getProfileShipToAddress,
  getProfileShippingAddress,
} from '../../util/shipping';
import { showCreateListingLinkForUser, showPaymentDetailsForUser } from '../../util/userHelpers';
import { isScrollingDisabled } from '../../ducks/ui.duck';

// Import shared components
import {
  ButtonTabNavHorizontal,
  H3,
  LayoutSideNavigation,
  Page,
  ShippingAddressForm,
  UserNav,
} from '../../components';

// Import modules from parent directory
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

// Import modules from this directory
import { clearSaveAddressState, saveShippingAddress } from './ShippingAddressesPage.duck';
import css from './ShippingAddressesPage.module.css';

const getAddressInitialValues = address => {
  const { name, phone, street1, streetNo, city, state, zip } = address || {};
  return {
    name: name || '',
    phone: phone || '',
    street1: street1 || '',
    streetNo: streetNo || '',
    city: city || '',
    state: state || '',
    zip: zip || '',
  };
};

/**
 * The Shipping addresses page in account settings. It has 2 tabs:
 * - Ship from: the address the user ships their listings from (profile.privateData.shippingAddress)
 * - Ship to: the address the user wants their orders delivered to (profile.privateData.shipToAddress)
 *
 * Addresses are validated with Shippo before they are saved.
 * The tab can be selected with the "tab" query parameter, e.g. ?tab=shipTo
 *
 * @component
 * @returns {JSX.Element} ShippingAddressesPage component
 */
const ShippingAddressesPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();

  const currentUser = useSelector(state => state.user.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const { saveAddressInProgress, saveAddressError, savedAddressType } = useSelector(
    state => state.ShippingAddressesPage
  );

  const tabFromUrl = parse(location.search)?.tab;
  const [selectedTab, setSelectedTab] = useState(
    SHIPPING_ADDRESS_TYPES.includes(tabFromUrl) ? tabFromUrl : SHIP_FROM_ADDRESS
  );

  const shippingAddress = getProfileShippingAddress(currentUser);
  const shipToAddress = getProfileShipToAddress(currentUser);
  const initialValues = useMemo(
    () =>
      getAddressInitialValues(selectedTab === SHIP_FROM_ADDRESS ? shippingAddress : shipToAddress),
    [selectedTab, shippingAddress, shipToAddress]
  );

  const selectTab = addressType => {
    setSelectedTab(addressType);
    dispatch(clearSaveAddressState());
    history.replace({ ...location, search: `?tab=${addressType}` });
  };

  const tabs = SHIPPING_ADDRESS_TYPES.map(addressType => ({
    text: <FormattedMessage id={`ShippingAddressesPage.${addressType}TabTitle`} />,
    selected: selectedTab === addressType,
    onClick: () => selectTab(addressType),
  }));

  const handleSubmit = values => {
    const { name, phone, street1, streetNo = '', city, state, zip, country } = values;
    const address = { name, phone, street1, streetNo, city, state, zip, country };
    // Errors are shown from the store (saveAddressError)
    return dispatch(saveShippingAddress({ addressType: selectedTab, address })).catch(() => null);
  };

  const title = intl.formatMessage({ id: 'ShippingAddressesPage.title' });
  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'ShippingAddressesPage',
    showPaymentMethods,
    showPayoutDetails,
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation
        topbar={
          <>
            <TopbarContainer
              desktopClassName={css.desktopTopbar}
              mobileClassName={css.mobileTopbar}
            />
            <UserNav
              currentPage="ShippingAddressesPage"
              showManageListingsLink={showManageListingsLink}
            />
          </>
        }
        sideNav={null}
        useAccountSettingsNav
        accountSettingsNavProps={accountSettingsNavProps}
        footer={<FooterContainer />}
        intl={intl}
      >
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="ShippingAddressesPage.heading" />
          </H3>

          <ButtonTabNavHorizontal
            className={css.tabs}
            tabs={tabs}
            ariaLabel={intl.formatMessage({ id: 'ShippingAddressesPage.tabsAriaLabel' })}
          />

          <p className={css.helper}>
            <FormattedMessage id={`ShippingAddressesPage.${selectedTab}Helper`} />
          </p>

          {currentUser?.id ? (
            <ShippingAddressForm
              key={selectedTab}
              formId={`ShippingAddressesPage.${selectedTab}`}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              inProgress={saveAddressInProgress === selectedTab}
              saveAddressError={
                saveAddressError?.addressType === selectedTab ? saveAddressError.error : null
              }
              addressSaved={savedAddressType === selectedTab}
              submitButtonText={intl.formatMessage({ id: 'ShippingAddressesPage.saveAddress' })}
            />
          ) : null}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

export default ShippingAddressesPage;
