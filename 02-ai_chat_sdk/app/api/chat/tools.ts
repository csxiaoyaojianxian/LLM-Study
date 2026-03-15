// 天气查询工具
export async function getWeather({ city }: { city: string }) {
  // 模拟数据（实际项目中调用真实天气API）
  const mockWeather: Record<string, any> = {
    '北京': { temp: 25, condition: '晴', humidity: '40%', wind: '3级' },
    '上海': { temp: 28, condition: '多云', humidity: '65%', wind: '4级' },
    '深圳': { temp: 30, condition: '雷阵雨', humidity: '80%', wind: '5级' },
    '杭州': { temp: 26, condition: '阴', humidity: '55%', wind: '2级' },
  };

  const weather = mockWeather[city] || { 
    temp: 22, 
    condition: '未知', 
    humidity: '50%',
    wind: '2级'
  };

  return {
    city,
    temperature: weather.temp,
    condition: weather.condition,
    humidity: weather.humidity,
    wind: weather.wind,
    updateTime: new Date().toLocaleString('zh-CN'),
  };
}

// 可以添加更多工具...
export async function calculate({ expression }: { expression: string }) {
  try {
    // 安全计算（实际项目要用更安全的方案）
    const result = Function('"use strict"; return (' + expression + ')')();
    return { expression, result, success: true };
  } catch (e) {
    return { expression, error: '计算失败', success: false };
  }
}