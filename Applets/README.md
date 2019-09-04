# 微信小程序支付开发文档：        

https://pay.weixin.qq.com/wiki/doc/api/wxa/wxa_api.php?chapter=7_3&index=1

## 基本流程:

1. 申请商户平台账号 https://pay.weixin.qq.com/index.php/core/home/login?return_url=%2F

2. 微信小程序绑定已有商户号并开通微信支付 http://kf.qq.com/faq/140225MveaUz161230yqiIby.html

3. 登录商户平台对小程序授权，下载支付证书，记录商户号，支付密钥。

4. 阅读微信支付官方文档，完成接口的对接编码。

## 开发支付流程: 

1. 微信小程序的基本配置。(app_id[小程序唯一id]，mch_id[商户号]，md5_key[支付密钥]，notify_url[异步回调通知] )。

2. 按微信要求的顺序将参数组成键值对数组，并对其进行签名(先将参数进行字段排序，参数可以处理中文字符，在请求参数字符串后拼上支付密钥，最后md5，签名完成)

3. 所有请求参数和签名一起组成新数组，再转为XML。

4. 以XML格式参数，POST请求方式对https://api.mch.weixin.qq.com/pay/unifiedorder发起统一下单请求。

5. 微信服务器接收下单请求，返回预支付ID(prepay_id)到自己服务端。

6. 自己服务端联合预支付ID，小程序APPID，32位随机串，时间戳，签名方式一并返回到小程序。

7. 小程序根据微信提供的函数和返回的参数集调起微信支付。

8. 支付完成，微信通过异步通知到自己服务指定的控制器。

9. 接受微信返回的通知，将XML转为数组，需要先判断通知过来的是不是同一个订单(根据订单号)，因为有时微信异步通知，自己服务器未接收处理，他会过一段时间重复发起通知。

10. 根据通知状态，更新自己业务的数据表，最后返回一个成功标识的XML给微信服务器。

### 一、支付配置
```        
'wxxcx' =>[
        'app_id'            => 'wx4c0e*******664b4',      // 微信小程序appid
        'mch_id'            => '149***3342',              // 微信商户id
        'md5_key'           => '3FN8WHO**********iPnNoJ576AxMmwQ',   // 微信支付密钥
        'app_cert_pem'      => APP_PATH.'v1/wechat_cert/apiclient_cert.pem',  // 支付证书，统一下单不需，退款等其他接口需要
        'app_key_pem'       => APP_PATH.'v1/wechat_cert/apiclient_key.pem',
        'sign_type'         => 'MD5',// MD5  HMAC-SHA256
        'limit_pay'         => [
        ],
        'fee_type'          => 'CNY',// 货币类型  当前仅支持该字段
        'notify_url'        => 'https://***********.com/v1/Pay/notifyUrlApi',    // 异步通知地址
        'redirect_url'      => '',
        'return_raw'        => false,
    ]
```    

### 二、前端传来的参数或服务端生成
```
$this->openid = $openid;      // 前端也可不传
$this->out_trade_no = $out_trade_no;   // 服务端生成
$this->body = $body;
$this->total_fee = $total_fee;    // 最好服务端数据库抓取，避免前端传
$this->spbill_create_ip = $spbill_create_ip;  // 请求的ip地址
```

### 三、封装统一下单类
```
<?php

/**
 * @description: 小程序微信支付
 */

namespace app\v1\extend;

class WeixinPay {

    protected $appid;
    protected $mch_id;
    protected $key;
    protected $openid;
    protected $out_trade_no;
    protected $body;
    protected $total_fee;
    protected $notify_url;
    protected $spbill_create_ip;

    function __construct($appid, $openid, $mch_id, $key,$out_trade_no,$body,$total_fee,$notify_url,$spbill_create_ip) {
        
        $this->appid = $appid;
        $this->openid = $openid;
        $this->mch_id = $mch_id;
        $this->key = $key;
        $this->out_trade_no = $out_trade_no;
        $this->body = $body;
        $this->total_fee = $total_fee;
        $this->notify_url = $notify_url;
        $this->spbill_create_ip = $spbill_create_ip;
    }

    /************测试方法可删除*****************/
    public function test() {
        $ha = "hello world";
        return $this->appid;
    }
    /************可删除*****************/

    public function pay() {
        //统一下单接口
        $return = $this->weixinapp();
        return $return;
    }


    //统一下单接口
    private function unifiedorder() {

        $url = 'https://api.mch.weixin.qq.com/pay/unifiedorder';
        
         // 这里的参数顺序一定要按下面的，不然可能就一直报商户号此功能未授权等错误
        $parameters = array(
            'appid' => $this->appid,                            // 小程序ID
            //'body' => 'test',                                 // 商品描述
            'body' => $this->body,
            'mch_id' => $this->mch_id,                          // 商户号
            'nonce_str' => $this->createNoncestr(),             // 随机字符串
            'notify_url' => $this->notify_url,          //'https://shop.gdpress.cn/syw_jingzhun/index.php/Api/xiaochengxu/notify_url_api', // 通知地址 确保外网能正常访问
            'openid' => $this->openid,                          // 用户id

            // 'out_trade_no' => '2015450806125348',            // 商户订单号
            'out_trade_no'=> $this->out_trade_no,

            //'spbill_create_ip' => $_SERVER['REMOTE_ADDR'],    // 终端IP
            'spbill_create_ip' => $this->spbill_create_ip,      // 终端IP

            'total_fee' => floatval(($this->total_fee) * 100),  // 单位 分
            //'total_fee' => $this->total_fee,                  // 单位 分

            'trade_type' => 'JSAPI'                             // 交易类型
        );

        //统一下单签名
        $parameters['sign'] = $this->getSign($parameters);

        $xmlData =  $this->arrayToXml($parameters);
        $return  =  $this->xmlToArray($this->postXmlCurl($xmlData, $url, 60));
        //$return  =  $this->postXmlCurl($xmlData, $url, 60);
        
        // print_r($return);
        // die;
        return $return;
    }

    // curl请求方法封装
    private static function postXmlCurl($xml, $url, $second = 30) 
    {
        $ch = curl_init();
        //设置超时
        curl_setopt($ch, CURLOPT_TIMEOUT, $second);
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, FALSE); //严格校验
        //设置header
        curl_setopt($ch, CURLOPT_HEADER, FALSE);
        //要求结果为字符串且输出到屏幕上
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
        //post提交方式
        curl_setopt($ch, CURLOPT_POST, TRUE);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $xml);


        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
        curl_setopt($ch, CURLOPT_TIMEOUT, 40);
        set_time_limit(0);


        //运行curl
        $data = curl_exec($ch);
        //返回结果
        if ($data) {
            curl_close($ch);
            return $data;
        } else {
            $error = curl_errno($ch);
            curl_close($ch);
            throw new WxPayException("curl出错，错误码:$error");
        }
    }
    
    
    //数组转换成xml
    private function arrayToXml($arr) {
        $xml = "<xml>";
        foreach ($arr as $key => $val) {
            if (is_array($val)) {
                $xml .= "<" . $key . ">" . arrayToXml($val) . "</" . $key . ">";
            } else {
                $xml .= "<" . $key . ">" . $val . "</" . $key . ">";
            }
        }
        $xml .= "</xml>";
        return $xml;
    }

    //xml转换成数组
    private function xmlToArray($xml) {

        //禁止引用外部xml实体 
        libxml_disable_entity_loader(true);

        $xmlstring = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);

        $val = json_decode(json_encode($xmlstring), true);

        return $val;
    }


    //微信小程序接口
    private function weixinapp() {
        
        //统一下单接口
        $unifiedorder = $this->unifiedorder();

        // 统一下单出错，参数出错等原因
        if($unifiedorder['return_code'] == 'FAIL') {
            $retrunInfo['code'] = 0;
            $retrunInfo['msg'] = $unifiedorder['return_msg'];
            return $retrunInfo;
        }

        // print_r($unifiedorder);
        // die;

        $parameters = array(
            'appId' => $this->appid,                                // 小程序ID
            'timeStamp' => '' . time() . '',                        // 时间戳
            'nonceStr' => $this->createNoncestr(),                  // 随机串
            'package' => 'prepay_id=' . $unifiedorder['prepay_id'], // 数据包
            'signType' => 'MD5'                                     // 签名方式
        );

        // 小程序发起支付签名
        $parameters['paySign'] = $this->getSign($parameters);

        // 成功返回
        $retrunInfo['code'] = 1;
        $retrunInfo['msg'] = $parameters;
        return $retrunInfo;
    }


    //作用：产生随机字符串，不长于32位
    private function createNoncestr($length = 32) {
        $chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        $str = "";
        for ($i = 0; $i < $length; $i++) {
            $str .= substr($chars, mt_rand(0, strlen($chars) - 1), 1);
        }
        return $str;
    }


    //作用：生成签名
    private function getSign($Obj) {

        foreach ($Obj as $k => $v) {
            $Parameters[$k] = $v;
        }
        
        //签名步骤一：按字典序排序参数
        ksort($Parameters);
        $String = $this->formatBizQueryParaMap($Parameters, false);
        //签名步骤二：在string后加入KEY
        $String = $String . "&key=" . $this->key;
        //签名步骤三：MD5加密
        $String = md5($String);
        //签名步骤四：所有字符转为大写
        $result_ = strtoupper($String); 
        return $result_;
    }


    // 作用：格式化参数，签名过程需要使用
    private function formatBizQueryParaMap($paraMap, $urlencode) {

        $buff = "";
        ksort($paraMap);
        foreach ($paraMap as $k => $v) {
            if ($urlencode) {
                $v = urlencode($v);
            }
            $buff .= $k . "=" . $v . "&";
        }
        $reqPar;
        if (strlen($buff) > 0) {
            $reqPar = substr($buff, 0, strlen($buff) - 1);
        }

        return $reqPar;
    }

}
```

### 四、发起请求接口的业务代码
```
/**
 * desc: 这里开始统一下单支付 
 */

$wxxcx_config = config('pay.wxxcx');            // 微信小程序设置

$appid = $wxxcx_config['app_id'];               // 小程序id
$mch_id = $wxxcx_config['mch_id'];              // 支付商户id
$key = $wxxcx_config['md5_key'];                // 商户的支付密钥
$notify_url = $wxxcx_config['notify_url'];      // 微信服务器异步通知
$spbill_create_ip = $_SERVER['REMOTE_ADDR'];    // 客户端ip

$openid = $Xcxopenid;                           // 用户openid
$out_trade_no = $Orderno;                       // 订单编号

$body = $params['body'];                        // 订单描述
$total_fee = $Alltotal;                         // 支付金额


// 实例微信支付基类
$weixinPay = new WeixinPay($appid, $openid, $mch_id, $key,$out_trade_no,$body,$total_fee,$notify_url,$spbill_create_ip);
// 发起微信支付
$result = $weixinPay->pay();

if($result['code'] == 0) {      // 统一下单出错
    return $this->sendError(1, $result['msg'], 200);
}

// 获取预支付返回参成功
return $this->sendSuccess($result, 'success', 200);
die;
```

### 五、异步通知(根据自己的业务逻辑) 
```
/*微信支付的 异步通知 *回调地址*/   
public function notifyUrlApi() {
    //$xml = post_data();
    $xml = file_get_contents('php://input', 'r');  
        
    //将服务器返回的XML数据转化为数组  
    $data = $this->toArray($xml);  
        
    // 判断签名是否正确  判断支付状态  
    if (($data['return_code'] == 'SUCCESS') && ($data['result_code'] == 'SUCCESS')) {

        $result = $data;  
        //获取服务器返回的数据  
        $order_sn = $data['out_trade_no'];          // 订单单号  
        $openid = $data['openid'];                  // 付款人openID  
        $total_fee = ($data['total_fee'])/100;      // 付款金额  
        $transaction_id = $data['transaction_id'];  // 微信支付流水号  
            
        //查找订单  
        $order = Db::name('order')
        ->field('userid,status,order_type')
        ->where('status', 0)         // 订单状态 0未支付 1支付成功 2取消订单
        ->where('order_no', $order_sn)
        ->find();

        if($order) {   // 订单是否存在

            Db::startTrans();

            try {
                Db::name('order')   // 更新订单状态(order)
                    ->where('order_no', $order_sn)
                    ->update(['transaction_no' => $transaction_id, 'status' => 1]);

                if ($order['order_type'] == 0) {        // 更新圈子总金额
                    $order_recharge_record = Db::name('order_recharge_record')
                        ->where('order_no', $order_sn)
                        ->find();

                    Db::name('circle')
                        ->where('id', $order_recharge_record['circleid'])
                        ->setInc('total_amount', $total_fee);

                } else if ($order['order_type'] == 1) {    // 更新用户金额

                    Db::name('user')
                        ->where('id', $order['userid'])
                        ->setInc('balance', $total_fee);

                } else if ($order['order_type'] == 2) {    // 更新任务状态
                    $order_recharge_record = Db::name('order_recharge_record')
                        ->where('order_no', $order_sn)
                        ->find();

                    $task_ok_UPDATE['ok']      = 1;
                    $task_ok_UPDATE['ok_time'] = time();

                    // 更新任务表
                    Db::name('task')
                        ->where('task_no', $order_recharge_record['taskno'])
                        ->update($task_ok_UPDATE);

                    // 更新任务详细记录表
                    Db::name('task_record')
                        ->where('task_no', $order_recharge_record['taskno'])
                        ->update($task_ok_UPDATE);

                }else if ($order['order_type'] == 3) {    // 更新vip状态
                    $order_recharge_record = Db::name('order_recharge_record')
                        ->where('order_no', $order_sn)
                        ->find();

                    $task_ok_UPDATE['ok']      = 1;
                    $task_ok_UPDATE['ok_time'] = time();

                    // 更新任务表
                    Db::name('user_vip')
                        ->where('vip_no', $order_recharge_record['vip_no'])
                        ->update($task_ok_UPDATE);

                    // 更新任务详细记录表
                    Db::name('user_vip_record')
                        ->where('vip_no', $order_recharge_record['vip_no'])
                        ->update($task_ok_UPDATE);

                    $Vipuserid = Db::name('user_vip_record')->field(true)->where('vip_no', $order_recharge_record['vip_no'])->select();

                    $user_WHERE['id'] = ['in', array_column($Vipuserid, 'userid')];
                    Db::name('user')->where($user_WHERE)->update(['vip' => 1]);

                }else if ($order['order_type'] == 4) {    // 更新红包状态
                    $order_recharge_record = Db::name('order_recharge_record')
                        ->where('order_no', $order_sn)
                        ->find();

                    $task_ok_UPDATE['ok']      = 1;
                    $task_ok_UPDATE['ok_time'] = time();

                    // 更新任务表
                    Db::name('redpacket')
                        ->where('red_id', $order_recharge_record['red_id'])
                        ->update($task_ok_UPDATE);
                }

                Db::commit();
            }catch (Exception $e) {
                $result = false;  
                Db::rollback();
            }

            // $update['total_fee'] = $total_fee;             // 保存支付成功的金额
            // $update['transaction_no'] = $transaction_id;   // 保存支付商户号对应的ID号
            // $update['status'] = 1;                         // 订单状态 0未支付 1支付成功 2取消订单
                        
            // /**更新订单**/ 
            // Db::name('order')
            // ->where('status', 0)         // 订单状态 0未支付 1支付成功 2取消订单
            // ->where('order_no', $order_sn)
            // ->update($update);
            
        }else{      // 订单不存在 
            $result = false;  
        }
    }else {
        $result = false;  
    }  

    // 返回状态给微信服务器  
    if ($result) {  
        $str='<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';  
    }else{  
        $str='<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名失败]]></return_msg></xml>';  
    }

    echo $str;  
    return $result;  
}
```    

### 六、其他辅助方法(xml转数组
```
/**
* 将xml转为array
* @param  string $xml xml字符串
* @return array       转换得到的数组
*/
public function toArray($xml) {   
    //禁止引用外部xml实体
    libxml_disable_entity_loader(true);
    $result= json_decode(json_encode(simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA)), true);        
    return $result;
}
```    
