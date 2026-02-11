const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');

// 获取环境ID并初始化
const env = cloud.DYNAMIC_CURRENT_ENV;
cloud.init({ env });

const client = init(cloud);
const models = client.models;

exports.main = async (event, context) => {
    try {
        console.log("二维码生成云函数开始执行，接收到的参数：", event);

        const wxContext = cloud.getWXContext();
        const openid = wxContext.OPENID;
        console.log("获取到用户openid:", openid);

        if (!openid) {
            console.error("未获取到openid");
            return {
                code: 401,
                message: '未授权访问'
            };
        }

        const { content, type = 'reservation' } = event;

        if (!content) {
            return {
                code: 400,
                message: '缺少二维码内容'
            };
        }

        // 生成二维码图片
        const qrCodeResult = await generateQRCodeImage(content);

        if (qrCodeResult.success) {
            return {
                code: 200,
                data: {
                    qrCodeUrl: qrCodeResult.url,
                    content: content,
                    type: type
                },
                message: '二维码生成成功'
            };
        } else {
            return {
                code: 500,
                message: '二维码生成失败'
            };
        }

    } catch (err) {
        console.error('二维码生成云函数执行错误：', err);
        return {
            code: 500,
            message: '服务器错误：' + err.message
        };
    }
};

// 生成二维码图片的函数
async function generateQRCodeImage(content) {
    try {
        // 这里可以使用第三方二维码生成库
        // 由于微信小程序云函数环境的限制，我们使用一个简化的方案

        // 方案1：使用在线二维码生成服务
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(content)}`;

        // 方案2：如果需要上传到云存储，可以使用以下代码
        /*
        const result = await cloud.uploadFile({
          cloudPath: `qrcodes/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`,
          fileContent: Buffer.from(qrCodeImageData, 'base64')
        });
        
        return {
          success: true,
          url: result.fileID
        };
        */

        return {
            success: true,
            url: qrCodeUrl
        };

    } catch (error) {
        console.error('生成二维码图片失败：', error);
        return {
            success: false,
            error: error.message
        };
    }
}
