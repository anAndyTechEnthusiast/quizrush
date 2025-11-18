# config.py
import os
from datetime import timedelta

class Config:
    """基础配置类"""
    # 从环境变量读取，如果不存在则使用默认值（生产环境不要用默认值！）
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-change-in-production'
    DATABASE_PATH = os.environ.get('DATABASE_PATH') or os.path.join(os.path.dirname(os.path.abspath(__file__)), "questions.db")
    
    # 管理员用户列表 - 从环境变量读取，用逗号分隔
    admin_users_str = os.environ.get('ADMIN_USERS') or 'admin,administrator'
    ADMIN_USERS = [user.strip() for user in admin_users_str.split(',')]
    
    # 会话设置
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # 静态文件路径
    STATIC_PATH = os.environ.get('STATIC_PATH') or os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    STATIC_NEW_PATH = os.environ.get('STATIC_NEW_PATH') or os.path.join(os.path.dirname(os.path.abspath(__file__)), "static1")

class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    TESTING = False
    
    def __init__(self):
        # 将验证移到初始化时，而不是类定义时
        if not os.environ.get('SECRET_KEY'):
            raise ValueError("生产环境必须设置 SECRET_KEY 环境变量")
        super().__init__()