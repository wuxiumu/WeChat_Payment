// 登录
wx.login({
    success: res => {
      // 发送 res.code 到后台换取 openId, sessionKey, unionId
       var code=res.code;
       wx.request({
         url: address + 'api/onLogin',
         data: {code: code},
         success:function(res){
            console.log(res)
           that.user_id = res.data.user_id
           wx.setStorageSync('user_id', that.user_id);
           wx.setStorageSync('open_id', res.data.info.openid);
           var openid = res.data.info.openid;
           var access_token = res.data.info.session_key
           wx.request({
             url: address + 'api/getUserId',
             data: {openid:openid,access_token:access_token},
             method: 'POST',
             success: function (res) {
                console.log('发送成功')
             }
           })
         }
       })

    }
  })

  wx.request({

    url: 'https://kart.meiyoufan.com/payfee.php?fee=0.01&id=' + wx.getStorageSync('open_id'), // 改成你自己的链接
    header: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    method: 'POST',
    success: function (res) {
      console.log(res.data);
      console.log('调起支付');
      
      wx.requestPayment({
        'timeStamp': res.data.timeStamp,
        'nonceStr': res.data.nonceStr,
        'package': res.data.package,
        'signType': 'MD5',
        'paySign': res.data.paySign,
        'success': function (res) {
          console.log('success');
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            duration: 3000
          });
        },
        'fail': function (res) {
          console.log('fail');
        },
        'complete': function (res) {
          console.log('complete');
        }
      });
    },
    fail: function (res) {
      console.log(res.data)
    }
  });
