const {
    init
} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const client = init(cloud);
const models = client.models;

// 通用错误处理函数
const handleError = (err, event) => {
    console.error('Error:', err, 'Event:', event);
    return {
        code: 500,
        message: err.message
    };
};

/**
 * 获取轮播图列表
 * @param {object} data - 请求参数
 * @returns {Promise<object>} 返回轮播图数据
 */
async function getBanners(data = {}) {
    try {
        console.log('[get-banners] 开始获取轮播图数据');

        // 使用数据模型查询 Banner 集合
        let bannerList = [];

        try {
            // 使用 models API 查询 Banner（首字母大写）
            const { data: bannerResult } = await models.Banner.list({
                filter: {
                    where: {
                        // 可以添加筛选条件，例如只获取启用的banner
                        // isActive: { $eq: true }
                    },
                    orderBy: [
                        {
                            field: 'sort',
                            order: 'ASC' // 按 sort 字段升序排序
                        }
                    ]
                },
                envType: "prod"
            });

            if (bannerResult && bannerResult.records) {
                bannerList = bannerResult.records;
                console.log('[get-banners] 使用 models API 成功，获取到', bannerList.length, '条数据');
            }
        } catch (modelError) {
            console.log('[get-banners] models API 失败，尝试使用数据库API:', modelError.message);

            // 回退到数据库API
            try {
                const dbResult = await db.collection('banner')
                    .orderBy('sort', 'asc')
                    .get();

                bannerList = dbResult.data || [];
                console.log('[get-banners] 使用数据库API成功，获取到', bannerList.length, '条数据');
            } catch (dbError) {
                console.error('[get-banners] 数据库查询失败:', dbError);

                // 如果排序失败（可能是 sort 字段不存在），尝试不排序查询
                try {
                    const dbResult = await db.collection('banner').get();
                    bannerList = dbResult.data || [];
                    console.log('[get-banners] 无排序查询成功，获取到', bannerList.length, '条数据');

                    // 手动按 sort 字段排序
                    if (bannerList.length > 0) {
                        bannerList.sort((a, b) => {
                            const sortA = a.sort || 0;
                            const sortB = b.sort || 0;
                            return sortA - sortB;
                        });
                    }
                } catch (fallbackError) {
                    console.error('[get-banners] 无排序查询也失败:', fallbackError);
                    bannerList = [];
                }
            }
        }

        // 格式化返回数据，只返回 imgurl 和 sort 字段
        const formattedBanners = bannerList.map(banner => ({
            _id: banner._id,
            imgurl: banner.imgUrl || '',
            sort: banner.sort || 0 // 排序字段
        }));

        // 如果没有数据，返回空数组
        return {
            code: 200,
            message: '获取banner数据成功',
            data: formattedBanners
        };

    } catch (error) {
        console.error('[get-banners] 获取轮播图失败:', error);
        return {
            code: 500,
            message: "获取轮播图失败: " + error.message,
            data: []
        };
    }
}

// 主函数
exports.main = async (event, context) => {
    const {
        action = 'getBanners', // 默认 action
        data
    } = event;

    try {
        switch (action) {
            case 'getBanners':
                return await getBanners(data);

            default:
                return {
                    code: 400,
                    message: "未知操作: " + action
                };
        }
    } catch (err) {
        return handleError(err, event);
    }
};
