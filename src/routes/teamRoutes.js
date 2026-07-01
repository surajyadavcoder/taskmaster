const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const teamController = require('../controllers/teamController');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Team name is required')],
  validate,
  teamController.createTeam
);

router.get('/', teamController.getMyTeams);

router.get('/:teamId', teamController.getTeam);

router.post(
  '/:teamId/invite',
  [body('email').isEmail().withMessage('A valid email is required')],
  validate,
  teamController.inviteMember
);

router.post(
  '/join',
  [body('inviteCode').trim().notEmpty().withMessage('Invite code is required')],
  validate,
  teamController.joinByInviteCode
);

router.delete('/:teamId/members/:userId', teamController.removeMember);

module.exports = router;
