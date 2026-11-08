import api from './api';

export const websiteService = {
  async getWebsites(params = {}) {
    const response = await api.get('/websites', { params });
    return response.data;
  },

  async getWebsiteById(id) {
    const response = await api.get(`/websites/${id}`);
    return response.data;
  },

  async createWebsite(data) {
    const response = await api.post('/websites', data);
    return response.data;
  },

  async updateWebsite(id, data) {
    const response = await api.put(`/websites/${id}`, data);
    return response.data;
  },

  async deleteWebsite(id) {
    const response = await api.delete(`/websites/${id}`);
    return response.data;
  },

  async triggerCheck(id) {
    const response = await api.post(`/websites/${id}/check`);
    return response.data;
  },

  async toggleMonitoring(id, enabled) {
    const response = await api.patch(`/websites/${id}/monitoring`, { enabled });
    return response.data;
  },

  async downloadCsv(id, filename) {
    const response = await api.get(`/websites/${id}/export-csv`, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `site_${id}_history.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};
