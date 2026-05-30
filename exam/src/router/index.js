import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import CollectionView from '../views/CollectionView.vue'
import ImportView from '../views/ImportView.vue'
import ReviewView from '../views/ReviewView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/collection/:type', // type: 'wrong' | 'favorite'
      name: 'collection',
      component: CollectionView
    },
    {
      path: '/import',
      name: 'import',
      component: ImportView
    },
    {
      path: '/review/:id',
      name: 'review',
      component: ReviewView
    }
  ]
})

export default router