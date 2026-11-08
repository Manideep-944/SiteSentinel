import api from './api';

export const analyticsService = {
  async getDashboardOverview() {
    const response = await api.get('/analytics/overview');
    return response.data;
  },

  async getWebsiteHistory(id, params = {}) {
    const response = await api.get(`/websites/${id}/history`, { params });
    return response.data;
  },

  async getWebsiteAnalytics(id, params = {}) {
    const response = await api.get(`/websites/${id}/analytics`, { params });
    return response.data;
  },

  async getSystemHealth() {
    const response = await api.get('/health');
    return response.data;
  }
};
