from flask import Flask, g, jsonify, request, send_from_directory, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3, os, random
from datetime import datetime
import time
from dotenv import load_dotenv  # 用于加载.env文件

# 加载环境变量（开发环境）
load_dotenv()

# 根据环境变量选择配置
env = os.environ.get('FLASK_ENV') or 'development'
if env == 'production':
    from config import ProductionConfig as Config
else:
    from config import DevelopmentConfig as Config

# 创建Flask应用
app = Flask(__name__)

# 应用配置
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY  # 或者 app.config['SECRET_KEY']

# 现在使用app.config来获取配置
ADMIN_USERS = app.config['ADMIN_USERS']
DB_PATH = app.config['DATABASE_PATH']
STATIC_PATH = app.config['STATIC_PATH']
STATIC_NEW_PATH = app.config['STATIC_NEW_PATH']



def is_admin_user():
    """检查当前用户是否是管理员"""
    if 'user_id' not in session:
        return False
    
    username = session.get('username', '')
    # 不区分大小写检查
    return username.lower() in [admin.lower() for admin in ADMIN_USERS]


# ---------------- 数据库连接 ----------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, check_same_thread=False)
        g.db.execute("PRAGMA journal_mode=WAL;")
        g.db.execute("PRAGMA synchronous=NORMAL;")
        # 添加这行：让查询返回字典形式
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()

# ---------------- 静态文件 ----------------
@app.route('/static1/<path:filename>')
def static1_files(filename):
    return send_from_directory(STATIC_PATH, filename)

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(STATIC_NEW_PATH, filename)


# ---------------- 获取题目 ----------------
@app.route("/get_questions")
def get_questions():
    score = int(request.args.get("score", 0))
    level = int(request.args.get("level", 0))  # 获取前端传递的level参数
    limit = int(request.args.get("limit", 50))

    # 根据level参数选择难度（优先使用level参数）
    if level == 0:
        diff = "easy"
    elif level == 1:
        diff = "medium"
    elif level == 2:
        diff = "hard"
    elif level == 3:
        diff = "sadistic"
    else:
        if score < 100:
            diff = "easy"
        elif score < 200:
            diff = "medium"
        elif score < 300:
            diff = "hard"
        else:
            diff = "sadistic"

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) FROM questions WHERE difficulty=?", (diff,))
    total_count = cur.fetchone()[0]
    print(f"📊 难度 {diff} 的总题目数: {total_count}")

    if total_count == 0 and diff == "sadistic":
        print("⚠️ SADISTIC难度无题目，回退到HARD难度")
        diff = "hard"
        cur.execute("SELECT COUNT(*) FROM questions WHERE difficulty=?", (diff,))
        total_count = cur.fetchone()[0]

    cur.execute("""
        SELECT id, difficulty, category, question, answer,
               option_a, option_b, option_c, option_d, option_e
        FROM questions
        WHERE difficulty=?
        ORDER BY RANDOM()
        LIMIT ?
    """, (diff, limit))
    rows = cur.fetchall()

    print(f"📥 实际查询到的题目数: {len(rows)}")

    data = []
    for r in rows:
        qid, difficulty, category, q, a, oa, ob, oc, od, oe = r
        qtype = "choice"
        opts = [opt for opt in [oa, ob, oc, od, oe] if opt]
        if not opts:
            qtype = "math"
        data.append({
            "id": qid,
            "difficulty": difficulty,
            "category": category,
            "q": q,
            "a": a,
            "type": qtype,
            "opts": opts
        })

    random.shuffle(data)
    print(f"📤 最终返回的题目数: {len(data)}")
    return jsonify(data)






@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "bad request"}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "not found"}), 404


@app.route('/')
def index():
    return render_template('index.html')


# ---------------- 用户注册 ----------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"success": False, "message": "用户名和密码不能为空"})
    
    username = data['username'].strip()
    password = data['password']
    email = data.get('email', '').strip()
    
    # 用户名验证（放宽限制）
    if len(username) < 3:
        return jsonify({"success": False, "message": "用户名至少3个字符"})
    
    if len(username) > 20:
        return jsonify({"success": False, "message": "用户名不能超过20个字符"})
    
    # 密码验证：至少8个字符
    if len(password) < 8:
        return jsonify({"success": False, "message": "密码至少8个字符"})
    
    db = get_db()
    try:
        # 检查用户名是否已存在
        existing_user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing_user:
            return jsonify({"success": False, "message": "用户名已存在，请选择其他用户名"})
        
        # 检查邮箱是否已存在（如果提供了邮箱）
        if email:
            existing_email = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            if existing_email:
                return jsonify({"success": False, "message": "邮箱已被注册"})
        
        # 创建新用户
        password_hash = generate_password_hash(password)
        db.execute("""
            INSERT INTO users (username, password_hash, email) 
            VALUES (?, ?, ?)
        """, (username, password_hash, email))
        db.commit()
        
        return jsonify({"success": True, "message": "注册成功"})
        
    except Exception as e:
        return jsonify({"success": False, "message": f"注册失败: {str(e)}"})


# ---------------- 用户登录 ----------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"success": False, "message": "用户名和密码不能为空"})
    
    username = data['username'].strip()
    password = data['password']
    
    db = get_db()
    user = db.execute("""
        SELECT id, username, password_hash, max_score, max_streak, max_mistake 
        FROM users WHERE username = ?
    """, (username,)).fetchone()
    
    if not user:
        return jsonify({"success": False, "message": "用户名或密码错误"})
    
    # 使用索引访问：id=0, username=1, password_hash=2, 等等
    if not check_password_hash(user[2], password):  # password_hash是第3个字段（索引2）
        return jsonify({"success": False, "message": "用户名或密码错误"})
    
    # 登录成功，更新最后登录时间
    db.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user[0],))
    db.commit()
    
    # 设置会话 - 确保使用正确的字段名
    session['user_id'] = user['id']  # 使用字段名访问
    session['username'] = user['username']  # 使用字段名访问
    
    # 调试信息
    print(f"🔐 用户登录成功: {user['username']}, 管理员状态: {is_admin_user()}")
    
    return jsonify({
        "success": True, 
        "message": "登录成功",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "max_score": user['max_score'],
            "max_streak": user['max_streak'],
            "max_mistake": user['max_mistake']
        }
    })

# ---------------- 用户登出 ----------------
@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "已退出登录"})

# ---------------- 获取当前用户信息 ----------------
@app.route("/get_current_user")
def get_current_user():
    if 'user_id' not in session:
        return jsonify({"logged_in": False})
    
    db = get_db()
    user = db.execute("""
        SELECT id, username, max_score, max_streak, max_mistake 
        FROM users WHERE id = ?
    """, (session['user_id'],)).fetchone()
    
    if user:
        # 调试信息
        print(f"🔍 获取当前用户: {user['username']}, 管理员状态: {is_admin_user()}")
        
        return jsonify({
            "logged_in": True,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "max_score": user['max_score'],
                "max_streak": user['max_streak'],
                "max_mistake": user['max_mistake']
            }
        })
    else:
        session.clear()
        return jsonify({"logged_in": False})


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(STATIC_PATH, "favicon.ico")


@app.route("/submit_answer", methods=["POST"])
def submit_answer():
    if "user_id" not in session:
        return jsonify({"success": False, "message": "请先登录"})
    
    data = request.get_json()
    qid = data.get("question_id")
    is_correct = bool(data.get("is_correct"))
    selected_option = data.get("selected_option")
    answer_time = data.get("answer_time")
    
    db = get_db()
    db.execute("""
        INSERT INTO question_stats (question_id, user_id, is_correct, selected_option, answer_time)
        VALUES (?, ?, ?, ?, ?)
    """, (qid, session["user_id"], is_correct, selected_option, answer_time))
    db.commit()
    
    return jsonify({"success": True})


@app.route("/update_question_stats", methods=["POST"])
def update_question_stats():
    data = request.get_json()
    qid = data.get("question_id") or data.get("id")
    correct = bool(data.get("correct"))
    selected_option = data.get("selected_option")
    answer_time = data.get("answer_time")
    session_id = data.get("session_id")  

    if not qid:
        return jsonify(success=False, message="缺少题目ID")

    db = get_db()
    cur = db.cursor()
    
    # 获取用户ID（如果已登录）
    user_id = session.get('user_id')
    
    print(f"📝 更新题目统计: 题目ID={qid}, 用户ID={user_id}, 会话ID={session_id}, 用时={answer_time}")
    
    # 所有题目都进行难题标记
    is_difficult = False
    if answer_time is not None:
        # 根据 selected_option 判断题目类型
        if selected_option and selected_option in ['A', 'B', 'C', 'D', 'E']:
            question_type = 'choice'
            time_limit = 15
        else:
            question_type = 'math'
            time_limit = 40
        
        # 所有题目都标记难题（答题时间超过限时的80%）
        if answer_time > time_limit * 0.8:
            is_difficult = True
            print(f"🔥 标记为难题: 用时{answer_time}秒 > 阈值{time_limit * 0.8}秒")

    # 插入统计记录（包含用户ID和session_id）
    cur.execute("""
        INSERT INTO question_stats (question_id, user_id, is_correct, selected_option, answer_time, is_difficult, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (qid, user_id, correct, selected_option, answer_time, is_difficult, session_id))
    db.commit()
    
    print(f"✅ 统计记录插入成功")

    return jsonify(success=True)


@app.route("/get_question_chart_data/<int:qid>")
def get_question_chart_data(qid):
    db = get_db()
    cur = db.cursor()

    # 获取题目基本信息
    cur.execute("SELECT difficulty, answer FROM questions WHERE id = ?", (qid,))
    question = cur.fetchone()
    if not question:
        return jsonify({"error": "题目不存在"}), 404

    correct_answer = question['answer']
    
    # 判断题目类型
    cur.execute("""
        SELECT selected_option, COUNT(*) as count
        FROM question_stats
        WHERE question_id = ? AND selected_option IS NOT NULL
        GROUP BY selected_option
    """, (qid,))
    option_stats_raw = cur.fetchall()
    
    choice_options = ['A', 'B', 'C', 'D', 'E']
    has_choice_options = any(opt[0] in choice_options for opt in option_stats_raw)
    question_type = 'choice' if has_choice_options else 'math'
    
    # 所有题目类型都使用统一的时间限制判断
    # 选择题15秒，数学题40秒
    time_limit = 40 if question_type == 'math' else 15

    # 获取总体统计
    cur.execute("""
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) AS correct_count,
            AVG(answer_time) AS avg_time
        FROM question_stats
        WHERE question_id = ?
    """, (qid,))
    overall_stats = cur.fetchone()

    overall_avg_time = float(overall_stats['avg_time'] or 0) if overall_stats['avg_time'] else 0

    # 获取选项分布统计
    option_stats = {}
    time_stats = {}
    
    if question_type == 'choice':
        # 计算各个选项的分别平均时间
        options = ['A', 'B', 'C', 'D', 'E']
        for option in options:
            # 获取该选项的选择人数
            cur.execute("""
                SELECT COUNT(*)
                FROM question_stats
                WHERE question_id = ? AND selected_option = ?
            """, (qid, option))
            count_row = cur.fetchone()
            option_count = count_row[0] or 0
            
            total_count = overall_stats['total'] or 1
            percentage = round((option_count / total_count) * 100, 1) if total_count > 0 else 0
            
            option_stats[option] = {
                'count': option_count,
                'percentage': percentage
            }
            
            # 计算该选项的平均用时
            cur.execute("""
                SELECT AVG(answer_time)
                FROM question_stats
                WHERE question_id = ? AND selected_option = ? AND answer_time IS NOT NULL
            """, (qid, option))
            time_row = cur.fetchone()
            option_avg_time = float(time_row[0] or 0) if time_row[0] else 0
            
            time_stats[option] = option_avg_time
    else:
        # 数学题：统计正确/错误
        cur.execute("""
            SELECT 
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
                SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) as wrong_count
            FROM question_stats
            WHERE question_id = ?
        """, (qid,))
        math_stats = cur.fetchone()
        
        total_count = overall_stats['total'] or 1
        correct_count = math_stats['correct_count'] or 0
        wrong_count = math_stats['wrong_count'] or 0
        
        option_stats['正确'] = {
            'count': correct_count,
            'percentage': round((correct_count / total_count) * 100, 1) if total_count > 0 else 0
        }
        option_stats['错误'] = {
            'count': wrong_count,
            'percentage': round((wrong_count / total_count) * 100, 1) if total_count > 0 else 0
        }
        
        # 数学题所有选项共用总体平均用时
        time_stats['正确'] = overall_avg_time
        time_stats['错误'] = overall_avg_time

    # 获取当前用户的答题信息 - 所有题目都支持
    user_data = None
    
    # 获取最近一条有答题时间的记录（无论是否登录）
    cur.execute("""
        SELECT answer_time, is_difficult
        FROM question_stats
        WHERE question_id = ? AND answer_time IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
    """, (qid,))
    recent_record = cur.fetchone()
    
    print(f"📊 最近答题记录查询结果: {recent_record}")
    
    if recent_record:
        user_answer_time = recent_record['answer_time']
        print(f"⏱️ 最近答题时间: {user_answer_time}")
        
        user_time = float(user_answer_time)
        
        # 所有题目都标记难题（超过时间限制的80%）
        is_difficult = user_time > (time_limit * 0.8)
        
        user_data = {
            'answer_time': user_time,
            'is_difficult': is_difficult,
            'time_threshold': time_limit * 0.8
        }
        print(f"✅ 成功设置用户数据: {user_data}")
    else:
        print("❌ 未找到有答题时间的记录")

    print(f"📤 最终返回的用户数据: {user_data}")

    return jsonify({
        "question_type": question_type,
        "correct_answer": correct_answer,
        "time_limit": time_limit,
        "overall_stats": {
            "total": overall_stats['total'] or 0,
            "correct_count": overall_stats['correct_count'] or 0,
            "accuracy": round((overall_stats['correct_count'] or 0) / max(overall_stats['total'] or 1, 1) * 100, 1),
            "avg_time": overall_avg_time
        },
        "option_stats": option_stats,
        "time_stats": time_stats,
        "user_data": user_data,
        "overall_avg_time": overall_avg_time
    })



@app.route("/cleanup_stats")
def cleanup_stats():
    db = get_db()
    db.execute("DELETE FROM question_stats WHERE created_at < datetime('now', '-7 days')")
    db.commit()
    return jsonify({"success": True, "message": "清理完毕"})



@app.route("/api/session/start", methods=["POST"])
def start_session():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "无效数据"}), 400
            
        session_id = data.get("session_id")
        if not session_id:
            return jsonify({"success": False, "message": "缺少会话ID"}), 400
        
        db = get_db()
        
        # 简化检查逻辑
        existing = db.execute(
            "SELECT id FROM game_sessions WHERE id = ?", 
            (session_id,)
        ).fetchone()
        
        if not existing:
            db.execute("""
                INSERT INTO game_sessions (id, user_id, start_time)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            """, (session_id, session.get('user_id')))
            db.commit()
        
        return jsonify({"success": True, "session_id": session_id})
        
    except Exception as e:
        print(f"❌ start_session 错误: {e}")
        return jsonify({"success": False, "message": f"服务器错误: {str(e)}"}), 500

        

@app.route("/api/session/end", methods=["POST"])
def end_session():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "无效数据"}), 400
        
    session_id = data.get("session_id")
    
    if not session_id:
        return jsonify({"success": False, "message": "缺少会话ID"}), 400
    
    db = get_db()
    
    try:
        # 检查会话是否存在
        session_exists = db.execute(
            "SELECT id FROM game_sessions WHERE id = ?", 
            (session_id,)
        ).fetchone()
        
        if not session_exists:
            return jsonify({
                "success": False, 
                "message": "会话不存在，请重新开始游戏"
            }), 404
        
        # 确保数据类型正确
        final_score = int(data.get("final_score", 0))
        total_answered = int(data.get("total_answered", 0))
        total_correct = int(data.get("total_correct", 0))
        max_streak_during_game = int(data.get("max_streak", 0))  # 🆕 使用游戏过程中的最高连对
        
        accuracy = (total_correct / max(total_answered, 1)) * 100 if total_answered > 0 else 0
        
        print(f"📊 更新会话数据: 分数={final_score}, 最高连对={max_streak_during_game}, 答题数={total_answered}, 正确数={total_correct}, 正确率={accuracy:.2f}%")
        
        # 更新game_sessions表
        db.execute("""
            UPDATE game_sessions 
            SET end_time = CURRENT_TIMESTAMP,
                final_score = ?,
                max_streak = ?,
                accuracy = ?,
                total_answered = ?,
                total_correct = ?
            WHERE id = ?
        """, (final_score, max_streak_during_game, accuracy, total_answered, total_correct, session_id))
        
        # 传递正确的参数数量（6个参数）
        update_leaderboard(session_id, final_score, max_streak_during_game, accuracy, total_answered, max_streak_during_game)
        
        db.commit()
        return jsonify({"success": True, "message": "成绩提交成功"})
        
    except Exception as e:
        db.rollback()
        print(f"❌ 结束会话时发生错误: {str(e)}")
        return jsonify({
            "success": False, 
            "message": f"数据库更新失败: {str(e)}"
        }), 500


@app.route("/api/leaderboard/<leaderboard_type>")
def get_leaderboard(leaderboard_type):
    print(f"📊 获取排行榜: {leaderboard_type}")
    
    if leaderboard_type not in ['score', 'streak', 'accuracy']:
        return jsonify({"error": "Invalid leaderboard type"}), 400
    
    db = get_db()
    
    try:
        if leaderboard_type == 'score':
            order_field = 'score'
        elif leaderboard_type == 'streak':
            order_field = 'streak' 
        elif leaderboard_type == 'accuracy':
            order_field = 'accuracy'
        
        # 获取实际的排行榜数据
        query = f"""
            SELECT username, {order_field} as value, total_answered, created_at
            FROM leaderboard 
            WHERE leaderboard_type = ?
            ORDER BY value DESC
            LIMIT 10
        """
        
        print(f"🔍 执行SQL查询: {query}")
        rows = db.execute(query, (leaderboard_type,)).fetchall()
        
        print(f"✅ 查询结果: {len(rows)} 条记录")
        
        leaderboard_data = []
        
        # 添加实际数据
        for i, row in enumerate(rows, 1):
            row_dict = dict(row)
            leaderboard_data.append({
                "rank": i,
                "username": row_dict['username'],
                "value": row_dict['value'],
                "total_answered": row_dict.get('total_answered'),
                "is_current_user": False,
                "timestamp": row_dict['created_at'],
                "is_placeholder": False  # 实际数据
            })
        
        # 🆕 如果记录不足10条，用占位记录填充
        while len(leaderboard_data) < 10:
            placeholder_rank = len(leaderboard_data) + 1
            
            if leaderboard_type == 'score':
                placeholder_text = "等待挑战"
                value_display = "0 分"
            elif leaderboard_type == 'streak':
                placeholder_text = "等待挑战" 
                value_display = "0 连对"
            else:  # accuracy
                placeholder_text = "等待挑战"
                value_display = "0%"
            
            leaderboard_data.append({
                "rank": placeholder_rank,
                "username": "---",
                "value": 0,
                "value_display": value_display,
                "placeholder_text": placeholder_text,
                "is_placeholder": True,  # 标记为占位记录
                "is_current_user": False
            })
        
        return jsonify(leaderboard_data)
        
    except Exception as e:
        print(f"❌ 获取排行榜时发生严重错误: {str(e)}")
        import traceback
        print(f"🔍 错误堆栈: {traceback.format_exc()}")
        return jsonify({"error": "获取排行榜失败"}), 500


@app.route("/api/debug/leaderboard_data")
def debug_leaderboard_data():
    """调试接口：检查排行榜数据"""
    db = get_db()
    
    # 检查所有排行榜数据
    leaderboard_stats = {}
    for lb_type in ['score', 'streak', 'accuracy']:
        try:
            count = db.execute(
                "SELECT COUNT(*) as count FROM leaderboard WHERE leaderboard_type = ?", 
                (lb_type,)
            ).fetchone()['count']
            
            sample_data = db.execute("""
                SELECT username, score, streak, accuracy, total_answered, created_at
                FROM leaderboard WHERE leaderboard_type = ?
                LIMIT 5
            """, (lb_type,)).fetchall()
            
            leaderboard_stats[lb_type] = {
                'count': count,
                'sample': [dict(row) for row in sample_data]
            }
        except Exception as e:
            leaderboard_stats[lb_type] = {'error': str(e)}
    
    return jsonify(leaderboard_stats)


@app.route("/api/debug/table_structure")
def debug_table_structure():
    """检查表结构"""
    db = get_db()
    
    tables = ['leaderboard', 'game_sessions']
    table_structures = {}
    
    for table in tables:
        try:
            # 获取表结构
            structure = db.execute(f"PRAGMA table_info({table})").fetchall()
            table_structures[table] = [dict(row) for row in structure]
        except Exception as e:
            table_structures[table] = {'error': str(e)}
    
    return jsonify(table_structures)

def fix_leaderboard_data():
    """修复排行榜数据"""
    db = get_db()
    
    try:
        # 1. 检查是否有无效数据
        invalid_data = db.execute("""
            SELECT id, session_id, username, score, streak, accuracy 
            FROM leaderboard 
            WHERE score IS NULL OR streak IS NULL OR accuracy IS NULL
        """).fetchall()
        
        if invalid_data:
            print(f"⚠️ 发现 {len(invalid_data)} 条无效数据，正在清理...")
            db.execute("DELETE FROM leaderboard WHERE score IS NULL OR streak IS NULL OR accuracy IS NULL")
        
        # 2. 确保所有必需字段都有值
        db.execute("""
            UPDATE leaderboard 
            SET score = COALESCE(score, 0),
                streak = COALESCE(streak, 0),
                accuracy = COALESCE(accuracy, 0)
            WHERE score IS NULL OR streak IS NULL OR accuracy IS NULL
        """)
        
        db.commit()
        print("✅ 排行榜数据修复完成")
        
    except Exception as e:
        print(f"❌ 修复排行榜数据失败: {e}")
        db.rollback()


def update_leaderboard(session_id, score, streak, accuracy, total_answered, max_streak_during_game):
    """更新排行榜的辅助函数 -> 只保留前10名"""
    db = get_db()
    
    try:
        # 获取用户名（登录用户或生成游客名）
        session_data = db.execute("""
            SELECT gs.user_id, u.username, gs.start_time
            FROM game_sessions gs
            LEFT JOIN users u ON gs.user_id = u.id
            WHERE gs.id = ?
        """, (session_id,)).fetchone()
        
        if session_data and session_data['user_id'] and session_data['username']:
            username = session_data['username']
        else:
            # 生成游客名：游客+会话ID前6位
            username = f"游客{session_id[:6]}"
        
        print(f"🔄 更新排行榜: 用户={username}, 分数={score}, 最高连对={max_streak_during_game}, 正确率={accuracy:.1f}%, 答题数={total_answered}")
        
        # 添加上榜条件检测标准：必须答题数超过30
        can_enter_score = total_answered >= 30 and score >= 100  # 分数榜门槛：30题且100分
        can_enter_streak = total_answered >= 30 and max_streak_during_game >= 10  # 连对榜门槛：30题且10连对
        can_enter_accuracy = total_answered >= 30 and accuracy >= 70  # 正确率榜门槛：30题且70%正确率   
        
        print(f"📊 上榜条件检测 - 分数: {can_enter_score}, 连对: {can_enter_streak}, 正确率: {can_enter_accuracy}")
        
        # 分数榜 - 满足条件才上榜
        if can_enter_score:
            # 先检查是否能进入前10
            current_top10_scores = db.execute("""
                SELECT score FROM leaderboard 
                WHERE leaderboard_type = 'score' 
                ORDER BY score DESC 
                LIMIT 10
            """).fetchall()
            
            can_enter_top10 = len(current_top10_scores) < 10 or score > min([row['score'] for row in current_top10_scores])
            
            if can_enter_top10:
                db.execute("""
                    INSERT INTO leaderboard (session_id, username, score, streak, accuracy, total_answered, leaderboard_type)
                    VALUES (?, ?, ?, ?, ?, ?, 'score')
                """, (session_id, username, score, max_streak_during_game, accuracy, total_answered))
                print(f"✅ 插入分数榜记录: {username} - {score}分")
                
                # 保持只保留前10名
                keep_top_n_records(db, 'score', 10)
            else:
                print(f"⏭️ 跳过分数榜: 分数{score}分未达到前10名门槛")
        
        # 连对榜 - 满足条件才上榜，使用游戏过程中的最高连对
        if can_enter_streak:
            # 先检查是否能进入前10
            current_top10_streaks = db.execute("""
                SELECT streak FROM leaderboard 
                WHERE leaderboard_type = 'streak' 
                ORDER BY streak DESC 
                LIMIT 10
            """).fetchall()
            
            can_enter_top10 = len(current_top10_streaks) < 10 or max_streak_during_game > min([row['streak'] for row in current_top10_streaks])
            
            if can_enter_top10:
                db.execute("""
                    INSERT INTO leaderboard (session_id, username, score, streak, accuracy, total_answered, leaderboard_type) 
                    VALUES (?, ?, ?, ?, ?, ?, 'streak')
                """, (session_id, username, score, max_streak_during_game, accuracy, total_answered))
                print(f"✅ 插入连对榜记录: {username} - {max_streak_during_game}连对")
                
                # 保持只保留前10名
                keep_top_n_records(db, 'streak', 10)
            else:
                print(f"⏭️ 跳过高连对榜: 最高连对{max_streak_during_game}未达到前10名门槛")
        
        # 正确率榜 - 满足条件才上榜
        if can_enter_accuracy:
            # 先检查是否能进入前10
            current_top10_accuracies = db.execute("""
                SELECT accuracy FROM leaderboard 
                WHERE leaderboard_type = 'accuracy' 
                ORDER BY accuracy DESC 
                LIMIT 10
            """).fetchall()
            
            can_enter_top10 = len(current_top10_accuracies) < 10 or accuracy > min([row['accuracy'] for row in current_top10_accuracies])
            
            if can_enter_top10:
                db.execute("""
                    INSERT INTO leaderboard (session_id, username, accuracy, total_answered, leaderboard_type)
                    VALUES (?, ?, ?, ?, 'accuracy')
                """, (session_id, username, accuracy, total_answered))
                print(f"✅ 插入正确率榜记录: {username} - {accuracy:.1f}%")
                
                # 保持只保留前10名
                keep_top_n_records(db, 'accuracy', 10)
            else:
                print(f"⏭️ 跳过正确率榜: 正确率{accuracy:.1f}%未达到前10名门槛")
        
        db.commit()
        print(f"✅ 排行榜更新完成")

    except Exception as e:
        print(f"❌ 更新排行榜时发生错误: {str(e)}")
        db.rollback()

def keep_top_n_records(db, leaderboard_type, n=10):
    """保持每个榜单只保留前N名记录"""
    try:
        # 找出需要保留的记录ID（前N名）
        if leaderboard_type == 'score':
            order_field = 'score DESC'
        elif leaderboard_type == 'streak':
            order_field = 'streak DESC'
        else:  # accuracy
            order_field = 'accuracy DESC'
        
        keep_ids = db.execute(f"""
            SELECT id FROM leaderboard 
            WHERE leaderboard_type = ? 
            ORDER BY {order_field}
            LIMIT ?
        """, (leaderboard_type, n)).fetchall()
        
        keep_ids = [row[0] for row in keep_ids]
        
        deleted_count = 0
        if keep_ids:
            # 删除排名在N名之后的记录
            placeholders = ','.join(['?'] * len(keep_ids))
            deleted_count = db.execute(f"""
                DELETE FROM leaderboard 
                WHERE leaderboard_type = ? AND id NOT IN ({placeholders})
            """, (leaderboard_type, *keep_ids)).rowcount
            
            if deleted_count > 0:
                print(f"✅ 清理 {leaderboard_type} 榜: 删除 {deleted_count} 条记录，保留前 {n} 名")
        
        return deleted_count
        
    except Exception as e:
        print(f"❌ 清理 {leaderboard_type} 榜前 {n} 名时出错: {e}")
        return 0


@app.route("/admin/keep_top10_only")
def keep_top10_only():
    """强制只保留三个榜单的前10名记录（仅管理员）"""
    # 检查用户是否登录且是管理员
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "请先登录"}), 401
    
    if not is_admin_user():  # 使用新的检查函数
        return jsonify({"success": False, "message": "权限不足，仅管理员可操作"}), 403
    
    try:
        db = get_db()
        total_deleted = 0
        details = []
        
        # 对三个榜单分别执行保留前10名
        for lb_type in ['score', 'streak', 'accuracy']:
            # 先获取当前记录数量
            current_count = db.execute(
                "SELECT COUNT(*) as count FROM leaderboard WHERE leaderboard_type = ?", 
                (lb_type,)
            ).fetchone()['count']
            
            deleted_count = keep_top_n_records(db, lb_type, 10)
            total_deleted += deleted_count
            
            # 获取清理后的记录数量
            after_count = db.execute(
                "SELECT COUNT(*) as count FROM leaderboard WHERE leaderboard_type = ?", 
                (lb_type,)
            ).fetchone()['count']
            
            details.append(f"{lb_type}榜: {current_count}→{after_count}条")
        
        db.commit()
        
        if total_deleted > 0:
            message = f"✅ 已强制保留各榜单前10名，共清理了 {total_deleted} 条记录。详情：{' | '.join(details)}"
        else:
            message = f"ℹ️ 各榜单均已为前10名，无需清理。当前状态：{' | '.join(details)}"
            
        return jsonify({
            "success": True, 
            "message": message,
            "details": details,
            "total_deleted": total_deleted
        })
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": f"操作失败: {str(e)}"}), 500


def validate_leaderboard_entries_simple():
    """简化版排行榜数据验证"""
    db = get_db()
    try:
        # 分数榜和连对榜（新标准）
        db.execute("DELETE FROM leaderboard WHERE leaderboard_type = 'score' AND (score < 100 OR total_answered < 30)")
        db.execute("DELETE FROM leaderboard WHERE leaderboard_type = 'streak' AND (streak < 10 OR total_answered < 30)")

        # 正确率榜使用 ROUND 函数避免浮点数精度问题
        db.execute("""
    DELETE FROM leaderboard 
    WHERE leaderboard_type = 'accuracy' 
    AND (ROUND(accuracy, 1) < 69.5 OR total_answered < 30)""")
        
        deleted_count = db.execute("SELECT changes()").fetchone()[0]
        if deleted_count > 0:
            db.commit()
            print(f"✅ 清理了 {deleted_count} 条不达标排行榜记录")
        
        return deleted_count
    except Exception as e:
        print(f"❌ 排行榜验证失败: {e}")
        db.rollback()
        return 0





# 在Flask中添加调试路由
@app.route("/api/debug/tables")
def debug_tables():
    """调试接口：检查表状态"""
    db = get_db()
    
    tables_to_check = ['game_sessions', 'leaderboard', 'question_stats']
    table_status = {}
    
    for table in tables_to_check:
        try:
            count = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            table_status[table] = {
                'exists': True,
                'count': count
            }
        except sqlite3.OperationalError:
            table_status[table] = {
                'exists': False,
                'count': 0
            }
    
    # 检查最近的数据
    recent_sessions = db.execute("""
        SELECT id, final_score, max_streak, accuracy, total_answered 
        FROM game_sessions 
        ORDER BY end_time DESC LIMIT 5
    """).fetchall()
    
    recent_leaderboard = db.execute("""
        SELECT username, score, streak, accuracy, leaderboard_type
        FROM leaderboard 
        ORDER BY created_at DESC LIMIT 10
    """).fetchall()
    
    return jsonify({
        'table_status': table_status,
        'recent_sessions': [dict(row) for row in recent_sessions],
        'recent_leaderboard': [dict(row) for row in recent_leaderboard]
    })

def optimize_database():
    """优化数据库性能"""
    db = get_db()
    
    # 为排行榜表添加索引
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_leaderboard_type ON leaderboard(leaderboard_type)",
        "CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC)",
        "CREATE INDEX IF NOT EXISTS idx_leaderboard_streak ON leaderboard(streak DESC)",
        "CREATE INDEX IF NOT EXISTS idx_leaderboard_accuracy ON leaderboard(accuracy DESC)",
        "CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_question_stats_session ON question_stats(session_id)"
    ]
    
    for index_sql in indexes:
        try:
            db.execute(index_sql)
            print(f"✅ 创建索引: {index_sql}")
        except Exception as e:
            print(f"⚠️ 创建索引失败: {e}")
    
    db.commit()


@app.route("/debug/leaderboard_all")
def debug_leaderboard_all():
    """查看所有排行榜数据"""
    db = get_db()
    
    try:
        all_data = db.execute("""
            SELECT id, session_id, username, score, streak, accuracy, total_answered, leaderboard_type, created_at
            FROM leaderboard 
            ORDER BY created_at DESC
            LIMIT 100
        """).fetchall()
        
        return jsonify({
            "total_records": len(all_data),
            "data": [dict(row) for row in all_data]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500



def init_tables():
    """初始化数据库表"""
    db = get_db()
    
    tables_to_create = {
        'game_sessions': """
            CREATE TABLE game_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                start_time DATETIME,
                end_time DATETIME,
                final_score INTEGER,
                max_streak INTEGER,
                accuracy REAL,
                total_answered INTEGER,
                total_correct INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """,
        'leaderboard': """
            CREATE TABLE leaderboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                username TEXT NOT NULL,
                score INTEGER,
                streak INTEGER,
                accuracy REAL,
                total_answered INTEGER,
                leaderboard_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """
    }
    
    for table_name, create_sql in tables_to_create.items():
        try:
            db.execute(f"SELECT 1 FROM {table_name} LIMIT 1")
            print(f"✅ {table_name} 表已存在")
        except sqlite3.OperationalError:
            print(f"❌ {table_name} 表不存在，创建表...")
            try:
                db.execute(create_sql)
                print(f"✅ {table_name} 表创建成功")
            except Exception as create_error:
                print(f"❌ 创建 {table_name} 表失败: {create_error}")
    
    # 检查 question_stats 表是否有 session_id 字段
    try:
        db.execute("SELECT session_id FROM question_stats LIMIT 1")
        print("✅ question_stats 表已有 session_id 字段")
    except sqlite3.OperationalError:
        print("❌ 为 question_stats 表添加 session_id 字段...")
        try:
            db.execute("ALTER TABLE question_stats ADD COLUMN session_id TEXT")
        except sqlite3.OperationalError as e:
            print(f"⚠️ 添加字段失败（可能已存在）: {e}")
    
    db.commit()


@app.route("/debug/status")
def debug_status():
    """调试接口：检查应用状态"""
    status = {
        "flask_running": True,
        "database_connected": False,
        "tables_status": {},
        "routes": []
    }
    
    try:
        db = get_db()
        status["database_connected"] = True
        
        # 检查关键表
        tables = ['users', 'questions', 'records', 'question_stats', 'game_sessions', 'leaderboard']
        for table in tables:
            try:
                db.execute(f"SELECT 1 FROM {table} LIMIT 1")
                status["tables_status"][table] = "exists"
            except sqlite3.OperationalError:
                status["tables_status"][table] = "missing"
        
        # 列出所有路由
        for rule in app.url_map.iter_rules():
            if rule.endpoint != 'static':
                status["routes"].append({
                    "endpoint": rule.endpoint,
                    "methods": list(rule.methods),
                    "rule": str(rule)
                })
                
    except Exception as e:
        status["error"] = str(e)
    
    return jsonify(status)

@app.route("/debug/admin_status")
def debug_admin_status():
    """调试接口：检查当前用户的管理员状态"""
    if 'user_id' not in session:
        return jsonify({
            "logged_in": False,
            "is_admin": False,
            "message": "用户未登录"
        })
    
    username = session.get('username', '')
    is_admin = is_admin_user()
    
    return jsonify({
        "logged_in": True,
        "username": username,
        "is_admin": is_admin,
        "admin_users": ADMIN_USERS,
        "message": f"用户 '{username}' 的管理员状态: {is_admin}"
    })

@app.route("/admin/cleanup_leaderboard_manual")
def cleanup_leaderboard_manual():
    """手动清理排行榜数据（仅管理员）"""
    # 检查用户是否登录且是管理员
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "请先登录"}), 401
    
    if not is_admin_user():  # 使用新的检查函数
        return jsonify({"success": False, "message": "权限不足，仅管理员可操作"}), 403
    
    try:
        deleted_count = validate_leaderboard_entries_simple()
        return jsonify({
            "success": True, 
            "message": f"手动清理完成，删除了 {deleted_count} 条不达标记录"
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"清理失败: {str(e)}"}), 500

# 在应用启动时调用（只调用一次）
with app.app_context():
    init_tables()
    optimize_database()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
