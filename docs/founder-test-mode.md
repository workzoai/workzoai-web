# Founder test mode

Use this when you need to test WorkZo repeatedly without being blocked by the public Free limit.

## Open

```txt
/dev-tools
```

## Test free flow

1. Click **Test as Free user**
2. Click **Open pricing test flow**
3. Choose Free
4. Start interview

## Test premium flow

1. Click **Test as Premium user**
2. Open `/interview?test=1`

## Manual reset from browser console

```js
localStorage.removeItem("workzo_usage_state_v2")
localStorage.setItem("workzo_plan_type", "free")
```

## Important

Public users still have the real limit:
- Free: 2 interviews
- Premium: 25/month

Test mode only applies when `workzo_founder_test_mode=1` exists in your own browser localStorage or you use `?test=1`.
