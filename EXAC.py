code = """
import random
print (random.randint(0,10))
print ("HELLO")
"""
# exec (code)


try: 
    exec(code)
except Exception as e:
    print (f"ERROR EXECUTING THE CODE DUE TO: {e}")