<template>
  <div class="login">
    <div class="section-1">
      <img src="/img/logos/yesplaymusic.png" />
      <svg-icon icon-class="x"></svg-icon>
      <img src="/img/logos/netease-music.png" />
    </div>
    <div class="section-2">
      <div
        class="card"
        @mouseover="activeCard = 1"
        @mouseleave="activeCard = 0"
        @click="goTo('account')"
      >
        <div class="container" :class="{ active: activeCard === 1 }">
          <div class="title-info">
            <div class="title">{{ $t('login.loginText') }}</div>
            <div class="info">{{ $t('login.accessToAll') }}</div>
          </div>
          <svg-icon icon-class="arrow-right"></svg-icon>
        </div>
      </div>
      <div
        class="card"
        @mouseover="activeCard = 2"
        @mouseleave="activeCard = 0"
        @click="goTo('username')"
      >
        <div class="container" :class="{ active: activeCard === 2 }">
          <div class="title-info">
            <div class="title">{{ $t('login.search') }}</div>
            <div class="info">{{ $t('login.readonly') }}</div>
          </div>
          <svg-icon icon-class="arrow-right"></svg-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import NProgress from 'nprogress';

import SvgIcon from '@/components/SvgIcon.vue';

export default {
  name: 'Login',
  components: {
    SvgIcon,
  },
  data() {
    return {
      activeCard: 0,
    };
  },
  created() {
    NProgress.done();
  },
  methods: {
    goTo(path) {
      this.$router.push({ path: '/login/' + path });
    },
  },
};
</script>

<style lang="scss" scoped>
.login {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 192px);
}

.section-1 {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  animation: fade-in 0.5s var(--ease-out-quint) both;
  img {
    height: 64px;
    margin: 20px;
  }
  .svg-icon {
    height: 24px;
    width: 24px;
    color: rgba(82, 82, 82, 0.28);
  }
}

.section-2 {
  display: flex;
  align-items: center;
  flex-direction: column;
  animation: fade-in 0.5s var(--ease-out-quint) 0.25s both;
}
.card {
  cursor: pointer;
  margin-top: 14px;
  margin-bottom: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #eaeffd;
  border-radius: 8px;
  height: 128px;
  width: 300px;
  transition: transform var(--duration-base) var(--ease-out-quint),
    box-shadow var(--duration-base) var(--ease-out-quart);
  box-shadow: 0 4px 8px -4px rgba(51, 94, 234, 0);
  padding-left: 22px;
  box-sizing: border-box;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px -8px rgba(51, 94, 234, 0.4);
  }
  &:active {
    transform: scale(0.98);
  }

  .active {
    .title-info {
      transform: translateX(-8px);
    }
    .svg-icon {
      opacity: 1;
      visibility: visible;
      transform: translateX(8px);
    }
  }

  .container {
    display: flex;
    // justify-content: space-around;
    align-items: center;

    color: #335eea;
  }

  .title-info {
    transition: transform var(--duration-base) var(--ease-out-quint),
      opacity var(--duration-fast) var(--ease-out-quart);
  }

  .title {
    font-size: 24px;
    font-weight: 600;
  }
  .info {
    margin-top: 2px;
    font-size: 14px;
    color: rgba(51, 94, 234, 0.78);
  }
  .svg-icon {
    opacity: 0;
    height: 24px;
    width: 24px;
    margin-left: 16px;
    transition: opacity var(--duration-fast) var(--ease-out-quart),
      transform var(--duration-base) var(--ease-out-quint);
  }
}
</style>
