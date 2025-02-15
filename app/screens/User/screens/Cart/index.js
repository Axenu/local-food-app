import React from 'react';
import { connect } from 'react-redux';
import { View, ListView, Text } from 'react-native';
import moment from 'moment';
import _ from 'lodash';

import AuthScreen from 'app/screens/Auth';

import { ContentWrapper, Loader, Button, Empty, List, ListSection, ScreenHeader } from 'app/components';
import CartItem from './components/CartItem';
import * as actions from './actions';
import { trans, priceHelper } from 'app/shared';
import globalStyle from 'app/styles';

const DataSource = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

class Cart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dataSource: null,
      refreshing: false,
    }
  }

  componentDidMount() {
    this.fetchCart();
  }

  componentDidUpdate(prevProps, prevState) {
    this.fetchCart();
  }

  fetchCart(refresh) {
    if (this.props.auth.user && (this.props.cart.cart === undefined || refresh)) {
      this.props.dispatch(actions.fetchCart(refresh));
    }
  }

  removeCartItem(id) {
    this.props.dispatch(actions.removeCartItem(id));
  }

  updateCartItem(id, quantity) {
    this.props.dispatch(actions.updateCartItem(id, quantity));
  }

  createOrder() {
    this.props.dispatch(actions.createOrder());
  }

  groupCartDateItemLinksByDate(cartDateItemLinks) {
    let groupedCartDateItemLinks = [];
    for (let i = 0; i < cartDateItemLinks.length; i++) {
      let cartDateItemLink = cartDateItemLinks[i];
      let cartDate = cartDateItemLink.cart_date_relationship[0];
      let key = moment(cartDate.date.date).format('YYYYMMDD');

      // Check if key exists
      let index = _.findIndex(groupedCartDateItemLinks, function(o) {
        return o.key == key;
      });

      if (index === -1) {
        groupedCartDateItemLinks.push({
          key: key,
          items: [],
        });

        // Set index
        index = groupedCartDateItemLinks.length - 1;
      }

      groupedCartDateItemLinks[index].items.push(cartDateItemLink);
    }

    return groupedCartDateItemLinks;
  }

  renderListSection(cartDateItemLinks, sectionId, rowId) {
    let m = moment(cartDateItemLinks.key);
    let date = m.format('DD') + ' ' + trans(m.format('MMMM'), this.props.lang) + ' ' + m.format('YYYY');

    const { updatingCartItems } = this.props.cart;

    let listItems = _.map(cartDateItemLinks.items, (cartDateItemLink, index) => {
      let loading = updatingCartItems.indexOf(cartDateItemLink.id) !== -1;
      let cartItemProps = {
        key: cartDateItemLink.id,
        data: cartDateItemLink,
        loading: loading,
        onRemove: this.removeCartItem.bind(this),
        onUpdate: this.updateCartItem.bind(this)
      }

      return <CartItem {...cartItemProps} lang={this.props.lang} />;
    });

    return (
      <ListSection label={trans('pickup', this.props.lang) + ' ' + date}>
        {listItems}
      </ListSection>
    );
  }

  render() {
    const { loading, refreshing, cart } = this.props.cart;

    if (!this.props.auth.user || this.props.auth.loading) {
      return <AuthScreen {...this.props} />;
    }

    if (loading) {
      return (
        <View style={{flex: 1, backgroundColor: globalStyle.backgroundColor}}>
          <ScreenHeader title={trans('cart', this.props.lang)} left navigation={this.props.navigation} />
          <Loader />
        </View>
      );
    }

    if (!refreshing && _.isEmpty(cart)) {
      return (
        <View style={{flex: 1, backgroundColor: globalStyle.backgroundColor}}>
          <ScreenHeader title={trans('cart', this.props.lang)} left navigation={this.props.navigation} />
          <Empty icon="shopping-basket" header={trans('cart_empty', this.props.lang)} text={trans('cart_empty_text', this.props.lang)} />
        </View>
      );
    }

    let totalCost = _.chain(cart)
    .groupBy(cartDateItemLink => {
      let item = cartDateItemLink.cart_item_relationship[0];
      return item.producer.currency;
    })
    .mapValues((cartDateItemLinks, currency) => {
      return _.sumBy(cartDateItemLinks, (cartDateItemLink) => {
        let item = cartDateItemLink.cart_item_relationship[0];
        let price = priceHelper.getCalculatedPrice(item.product, item.variant, cartDateItemLink.quantity);

        return price;
      });
    })
    .map((total, currency) => {
      if (!currency || currency === 'null') {
        currency = '';
      }

      return <Text style={styles.orderText} key={currency}>{total} {currency}</Text>;
    })
    .value();

    let cartDateItemLinksByDate = this.groupCartDateItemLinksByDate(cart);

    let listProps = {
      dataSource: DataSource.cloneWithRows(cartDateItemLinksByDate),
      renderRow: this.renderListSection.bind(this),
      onRefresh: this.fetchCart.bind(this, true),
      refreshing: refreshing,
    }

    return (
      <View style={{flex: 1}}>
        <ScreenHeader title={trans('cart', this.props.lang)} left navigation={this.props.navigation} />
        <List {...listProps} />
        <View style={styles.orderWrapper}>
          <View style={styles.orderTotals}>{totalCost}</View>
          <Button loading={this.props.cart.creating} icon='shopping-basket' title={trans('send_order', this.props.lang)} onPress={this.createOrder.bind(this)} />
        </View>
      </View>
    );
  }
}

function mapStateToProps(state) {
  const { auth, cart } = state;

  return {
    auth,
    cart,
  };
}

export default connect(mapStateToProps)(Cart);

let styles = {
  totalCost: {
    alignSelf: 'center',
  },
  orderWrapper: {
    backgroundColor: globalStyle.primaryColor,
    flexDirection: 'row',
    padding: 15,

    width: '100%',
  },
  orderTotals: {
    flex: 1,
    flexDirection: 'column',
  },
  orderText: {
    color: '#fff',
    fontFamily: 'montserrat-semibold',
  },
  orderButton: {
    flex: 1,
    button: {
      backgroundColor: '#ff9800',
    },
    title: {
      color: '#333',
    },
    icon: {
      color: '#333',
    }
  },
};
